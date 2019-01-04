'use strict';

/* jshint -W083 */

const fse = require('fs-extra');
const path = require('path');
const Mustache = require('mustache');

// Used to find the get translations arguments.
// E.g: {0}
const ARGS_REG_EXP = /\{\w+\}/g;

// Both regexp are used to get the method name from the translation key.
// E.g: error.Invalid -> errorInvalid
const UPPER_CASE_REG_EXP = /[A-Z]+/g;
const METHOD_REG_EXP = /[\. | \_ | \-]\w{1}/g;

// Used get the generated TS file name from the TS class name
// E.g: AccessMesagges -> access-messages.ts
const FILE_REG_EXP = /[A-Z]{1}/g;

/**
 * Main generation function
 */
function ngTranslationGen(options) {
  // load templates
  const loadTemplate = name => fse.readFileSync(path.join(__dirname, options.templates, name + ".mustache"), "utf-8");
  const templates = {};
  ['messages', 'class'].forEach(name => templates[name] = loadTemplate(name));

  // empty or create the output dir if not exists
  fse.emptyDirSync(path.normalize(options.output));

  // iterates over each translation file
  let fileNames = fse.readdirSync(options.input);
  // at this moment we're using the array only to know if at least one class
  // was generated (a flag would be enought but remains for future use)
  let generatedClasses = [];
  fileNames.forEach(fileName => {
    let pos = fileName.lastIndexOf('.');
    let onlyName = pos < 0 ? '' : fileName.substring(0, pos);
    if (fileName.endsWith('.json') && options.mapping.hasOwnProperty(onlyName)) {
      try {
        // load the translation file
        let translations = JSON.parse(fse.readFileSync(path.join(options.input, fileName), "utf-8"));

        // create the template's model
        let className = getClassName(onlyName, options);
        let model = getTemplateModel(translations, className);

        // render the template according to the model
        let code = Mustache.render(templates.messages, model, templates);

        // write the generated class
        let tsName = getTSFilename(className);
        let outFile = path.join(options.output, tsName + ".ts");
        fse.writeFileSync(outFile, code, "utf-8");
        console.info('Wrote ' + outFile);
        generatedClasses.push({ "name": className, "fileName": tsName, "last": false });
      } catch (error) {
        const e1 = new Error(`Generation aborted, error processing file: ${fileName} (${error}).`);
        e1.stack = error.stack;
        throw e1;
      }
    }
  });
  if (generatedClasses.length == 0) {
    console.log("Warning: No class was generated! Is this correct?");
  } else {
    // finally, copy all artifacts required by the generated code to the output folder
    fse.copySync(path.join(__dirname, 'static', "translations.ts"), path.join(options.output, "translations.ts"));
  }
}

/**
 * Return the model used to render the Mustache template.
 * @param translation the translations as a JSON object.
 * @param className the mapped class name for the translations file.
 * @param options the generator options
 */
function getTemplateModel(translations, className, path) {

  let model = {
    className: className,
    direct: [],
    nested: [],
    last: false,
    hasNested: false,
    path: path
  };
  const allKeys = Object.keys(translations);

  // First process all keys that have a translation directly
  const directKeys = allKeys.filter(k => typeof translations[k] === 'string');
  if (directKeys.length > 0) {
    for (const key of directKeys) {
      let positionalArgs = {};
      let namedArgs = {};
      const value = translations[key];
      // each match is of the form {argName} or {a_number}
      value.replace(ARGS_REG_EXP, (match) => {
        // remove leading '{' and trailing '}' chars
        let paramName = match.substring(1, match.length - 1);
        // if it is of the form {a_number} then the resulting param name will be
        // prefixed with 'arg'
        let positional = match.match(/\{\d+\}/);
        if (positional) {
          paramName = "arg" + paramName;
        }
        let param = {
          name: paramName,
          identifier: getValidIdentifier(paramName),
          type: 'string',
          last: false,
          lastTxArg: false
        };
        if (positional) {
          positionalArgs[paramName] = param;
          param.fullIdentifier = param.identifier;
        } else {
          namedArgs[paramName] = param;
          param.fullIdentifier = '$.' + param.identifier;
        }
      });

      // First add all positional args, in order
      let positionalKeys = Object.keys(positionalArgs);
      let namedKeys = Object.keys(namedArgs);
      let args = Object.keys(positionalArgs).sort().map(name => positionalArgs[name]);
      if (namedKeys.length > 0) {
        args.push({
          name: '$',
          type: `{${namedKeys.map(n => n + ': string').join(', ')}}`
        });
        let lastKey = namedKeys[namedKeys.length - 1];
        namedArgs[lastKey].lastTxArg = true;
      } else if (positionalArgs.length > 0) {
        positionalArgs[positionalArgs.length - 1].lastTxArg = true;
      }

      // mark the last argument to avoid render a trailing comma
      if (args.length > 0) {
        args[args.length - 1].last = true;
      }

      // Add the direct property model
      model.direct.push({
        name: getValidIdentifier(key),
        hasArgs: args.length > 0,
        last: false,
        args: args,
        txArgs: [...positionalKeys.map(k => positionalArgs[k]), ...namedKeys.map(k => namedArgs[k])],
        key: key
      });
    }

    // Flag the last direct key
    model.direct[model.direct.length - 1].last = true;
  }

  // Then process all nested models
  const nestedKeys = allKeys.filter(k => typeof translations[k] === 'object');
  if (nestedKeys.length > 0) {
    model.hasNested = true;
    for (const key of nestedKeys) {
      const value = translations[key];
      const nestedPath = (path ? path + '.' + key : key);
      let nestedClass = getValidIdentifier(key);
      nestedClass = nestedClass.charAt(0).toUpperCase() + nestedClass.substring(1);
      const nested = getTemplateModel(value, className + '$' + nestedClass, nestedPath);
      nested.property = key;
      nested.path = '\'' + nestedPath + '\'';
      model.nested.push(nested);
    }
    // Flag the last nested key
    model.nested[model.nested.length - 1].last = true;
  }

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
    return options.mapping[fileName];
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
  name = name.replace(METHOD_REG_EXP, (match) => match.substring(1).toUpperCase());
  if (name === 'initialize') {
    // Initialize is a special method - cannot be the name of a key
    name = 'initialize$';
  }
  return name;
}

module.exports = ngTranslationGen;