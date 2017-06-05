'use strict';

const fse = require('fs-extra');
const path = require('path');
const Mustache = require('mustache');

// Used to find the get translations arguments.
// E.g: {0}
const ARGS_REG_EXP = /\{\w+\}/g;

// Both regexp are used to get the method name from the translation key. 
// E.g: error.Invalid -> errorInvalid
const UPPER_CASE_REG_EXP = /[A-Z]+/g
const METHOD_REG_EXP = /[\. | \_ | \-]\w{1}/g;

// Used get the generated TS file name from the TS class name
// E.g: AccessMesagges -> access-messages.ts
const FILE_REG_EXP = /[A-Z]{1}/g

/**
 * Main generation function
 */
function ngTranslationGen(options) {
  // load class template
  let template = fse.readFileSync(path.join(__dirname, options.templates, 
    "messages.mustache"), "utf-8");
  
  // empty or create the output dir if not exists
  fse.emptyDirSync(path.normalize(options.output));

  // iterates over each translation file
  let fileNames = fse.readdirSync(options.input);
  // at this moment we're using the array only to know if at least one class
  // was generated (a flag would be enought but remains for future use)
  let generatedClasses = [];
  fileNames.forEach(fileName =>{
    let onlyName = fileName.split('.')[0];
    if (!options.includeOnlyMappedFiles || typeof options.mapping[onlyName] !== 'undefined') {
      try {
        // load the translation file
        let translations = JSON.parse(fse.readFileSync(path.join(options.input, 
          fileName), "utf-8"));
        
        // create the template's model
        let className = getClassName(onlyName, options)
        let model = getTemplateModel(translations, className);

        // render the template according to the model
        let code = Mustache.render(template, model);

        // write the generated class
        let tsName = getTSFilename(className);
        fse.writeFileSync(path.join(options.output, tsName + ".ts"), code, "utf-8");
        generatedClasses.push({"name": className, "fileName": tsName, "last": false});
      } catch (error) {
        throw new Error("Generation aborted, error processing file: " + fileName
          + " (" + error + ").");
      }
    }
  });
  if (generatedClasses.length == 0) {
    console.log("Warning: No class was generated! Is this correct?");
  } else {
    // finally, copy all artifacts required by the generated code to the output folder    
    fse.copySync(path.join(__dirname, "base-messages.ts"), path.join(options.output, "base-messages.ts"));
  }
}

/**
 * Return the model used to render the Mustache template.
 * @param translation the translations as a JSON object.
 * @param className the mapped class name for the translations file.
 * @param options the generator options
 */
function getTemplateModel(translations, className) {
  let model = {
    "class": {
      "name": className
    }
  };
  let methods = [];
  for (let key in translations) {
    let args = []
    let argsObject = {};
    //each match is of the form {argName} or {a_number}
    translations[key].replace(ARGS_REG_EXP, (match) => {
      // remove leading '{' and trailing '}' chars
      let paramName = match.substring(1, match.length - 1);
      // if it is of the form {a_number0} then the resultant param name will be 
      // prefixed with 'arg'
      if (match.match(/\{\d+\}/)) { 
        paramName = "arg" + paramName;
      }
      //avoid repeated
      if (!argsObject.hasOwnProperty(paramName)) {
        argsObject[paramName] = paramName;
        args.push({"name": paramName, "last" : false});
      }
    })    
    args.sort((a, b) => {
      let aName = a.name.toLowerCase();
      let bName = b.name.toLowerCase();
      if (aName < bName) {
        return -1;
      }
      if (aName > bName) {
        return 1;
      }
      return 0;
    });

    // mark the last argument to avoid render a trailing comma
    if (args.length > 0) {
      args[args.length - 1]["last"] = true;
    }
    let method = {
      "name": getValidIdentifier(key), 
      "args": args,
      "key": key
    };

    methods.push(method)
  }
  model["methods"] = methods;

  return model;
}

/**
 * Returns the TS class name for the given translation file name using the mapping
 * defined in the options. If there is no mapping for the file then use the 
 * capitalized version of the file name.
 */
function getClassName(fileName, options) {
  if (typeof options.mapping[fileName] === 'undefined') {
    // there is no mapping for the file then transform it to a valid identifier
    // and capitalize it
    let identifier = getValidIdentifier(fileName);
    if (!identifier.endsWith(options.classSuffix)) {
      identifier += options.classSuffix;
    }
    return identifier.charAt(0).toUpperCase() + identifier.substring(1);
  } else {
    return options.mapping[fileName]
  }
}

/**
 * Return the dashed-case version for the given camel-case class name plus the 
 * '.ts' suffix
 */
function getTSFilename(className) {
  let result = className.replace(FILE_REG_EXP, (match) => "-" + match.toLowerCase());
  if (result.startsWith("-")) {
    result = result.substring(1);
  }
  return result;
}

/**
 * Return a valid TS identifier from a given name.
 * @param name E.g. a trasnslation key of the form word1.word2.
 * @returns a camel-cased name of the form word1Word2.
 */
function getValidIdentifier(name) {
  // more than one char in upper case is lower cased
  name = name.replace(UPPER_CASE_REG_EXP, (match) => match.length == 1 ? match : match.toLowerCase());
  // each char after a '.', '_' or '-' is upper cased
  return name.replace(METHOD_REG_EXP, (match) => match.substring(1).toUpperCase())
}

module.exports = ngTranslationGen;