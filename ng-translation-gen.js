'use strict';

/* jshint -W083 */

const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const Handlebars = require('handlebars');
const crypto = require('crypto');

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
  const keys = Object.keys(options.mapping || {});
  if (keys.length === 0) {
    console.warn("No mapping specified");
    return;
  }

  // Read each template
  const templates = {};
  const dir = path.join(__dirname, "templates");
  for (const file of fs.readdirSync(dir)) {
    if (file.endsWith('.handlebars')) {
      const basename = file.substring(0, file.length - '.handlebars'.length);
      const fullname = path.join(dir, file);
      const content = String(fs.readFileSync(fullname));
      const template = Handlebars.compile(content)
      templates[basename] = template;
      Handlebars.registerPartial(basename, template);
    }
  }

  // empty or create the output dir if not exists
  fse.emptyDirSync(path.normalize(options.output));

  const defaultLocale = options.defaultLocale || 'en';
  const locales = (options.locales || []).length === 0 ? ['en'] : options.locales;
  const localesModel = getLocalesModel(locales);
  const additionalLocalesModel = localesModel.filter(l => l.locale !== defaultLocale);
  const argumentType = options.argumentType || 'string';

  for (const key of keys) {
    let baseName = key;
    if (baseName.toLowerCase().endsWith('.json')) {
      baseName = baseName.substring(0, baseName.length - 5);
    }
    const fileName = baseName + '.json';
    try {
      // Read the file content
      const fullFilename = path.join(options.input, fileName);
      const content = fs.readFileSync(fullFilename);
      let translations = JSON.parse(content, "utf-8");

      // Create the model
      let className = options.mapping[key];
      const model = getTemplateModel(translations, className, null, baseName, argumentType);

      // Set additional properties for the root model
      model.defaultLocale = defaultLocale;
      model.defaultFilename = fileName;
      model.defaultHash = contentHash(fullFilename);
      model.locales = locales;
      // Make a copy of each additional locale model
      model.additionalLocales = additionalLocalesModel.map(l => ({ ...l }));
      // Add the hashes for each additional locale
      model.additionalLocales.forEach(l => {
        const localeFilename = baseName + options.separator + l.locale + '.json';
        const localeFile = path.join(options.input, localeFilename);
        l.filename = localeFilename;
        l.hash = contentHash(localeFile);
      });
      model.separator = options.separator;

      // Render the template
      const code = templates.messages(model);

      // write the generated class
      let tsName = getTSFilename(className);
      let outFile = path.join(options.output, tsName + ".ts");
      fs.writeFileSync(outFile, code, "utf-8");
      console.info('Wrote ' + outFile);
    } catch (error) {
      const e1 = new Error(`Generation aborted, error processing file: ${fileName} (${error}).`);
      e1.stack = error.stack;
      throw e1;
    }
  }
  // finally, copy all artifacts required by the generated code to the output folder
  fs.copyFileSync(path.join(__dirname, 'static', "translations.ts"), path.join(options.output, "translations.ts"));
}

function contentHash(fileName) {
  let content;
  try {
    content = fs.readFileSync(fileName, {
      encoding: 'utf-8'
    });
  } catch (e) {
    return '';
  }
  return crypto.createHash('sha1').update(content, 'utf-8').digest('hex');
}

/**
 * Return the model used to render the template.
 */
function getTemplateModel(translations, className, path, baseName, argumentType) {

  let model = {
    className: className,
    baseName: baseName,
    direct: [],
    nested: [],
    hasNested: false,
    path: path,
    root: path == null || path === ''
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
          type: argumentType,
          lastTxArg: false
        };
        if (positional) {
          positionalArgs[paramName] = param;
        } else {
          namedArgs[paramName] = param;
        }
      });

      // Get both positional and named ards
      let positionalKeys = Object.keys(positionalArgs);
      let namedKeys = Object.keys(namedArgs);

      // If there's a single named arg, we handle it as positional
      if (namedKeys.length === 1) {
        let key = namedKeys[0];
        let arg = namedArgs[key];
        arg.positional = true;
        positionalKeys.push(key);
        positionalArgs[key] = arg;
        namedKeys = [];
        namedArgs = {};
      }

      // Set the full identifier
      for (let key of positionalKeys) {
        let arg = positionalArgs[key];
        arg.fullIdentifier = arg.identifier;
      }
      for (let key of namedKeys) {
        let arg = namedArgs[key];
        arg.fullIdentifier = '$.' + arg.identifier;
      }

      // First add all positional args, in order
      let args = Object.keys(positionalArgs).sort().map(name => positionalArgs[name]);
      if (namedKeys.length > 0) {
        args.push({
          name: '$',
          type: `{${namedKeys.map(n => n + ': ' + argumentType).join(', ')}}`
        });
        let lastKey = namedKeys[namedKeys.length - 1];
        namedArgs[lastKey].lastTxArg = true;
      } else if (positionalArgs.length > 0) {
        positionalArgs[positionalArgs.length - 1].lastTxArg = true;
      }

      // Add the direct property model
      model.direct.push({
        name: getValidIdentifier(key),
        defaultValue: value.replace(/\n/g, '\\n').replace(/\*\//g, "* /"),
        hasArgs: args.length > 0,
        args: args,
        txArgs: [...positionalKeys.map(k => positionalArgs[k]), ...namedKeys.map(k => namedArgs[k])],
        key: key
      });
    }
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
      const nested = getTemplateModel(value, className + '$' + nestedClass, nestedPath, null, argumentType);
      nested.property = key;
      nested.path = '\'' + nestedPath + '\'';
      model.nested.push(nested);
    }
  }

  return model;
}

/**
 * Returns the models for each locale
 */
function getLocalesModel(locales) {
  return locales.map(l => ({ locale: l }));
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