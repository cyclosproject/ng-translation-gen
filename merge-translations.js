'use strict';

/* jshint -W083 */

const fs = require('fs');
const path = require('path');

/**
 * Main function
 */
function mergeTranslations(options) {
  const mapping = Object.keys(options.mapping || {});
  const locales = options.locales || [];
  if (locales.length === 0) {
    console.warn("No locales specified");
    return;
  }
  if (mapping.length === 0) {
    console.warn("No mapping specified");
    return;
  }

  for (const key of Object.keys(options.mapping)) {
    let baseName = key;
    if (baseName.toLowerCase().endsWith('.json')) {
      baseName = baseName.substring(0, baseName.length - 5);
    }
    merge(baseName, options);
  }
}

function merge(baseName, options) {
  const baseFile = path.join(options.input, baseName + '.json');
  const baseValues = JSON.parse(fs.readFileSync(baseFile, { encoding: 'utf-8' }));
  const separator = options.separator || '.';
  for (const locale of options.locales) {
    if (locale === options.defaultLocale) {
      continue;
    }
    const localeFile = path.join(options.input, `${baseName}${separator}${locale}.json`);
    if (fs.existsSync(localeFile)) {
      const localeValues = JSON.parse(fs.readFileSync(localeFile, { encoding: 'utf-8' }));
      const added = addMissing(baseValues, localeValues);
      const removed = removeStale(baseValues, localeValues);
      if (added > 0 || removed > 0) {
        fs.writeFileSync(localeFile, JSON.stringify(localeValues, null, 2));
        console.info(`Write ${localeFile} with ${added} new and ${removed} removed keys`);
      } else {
        console.info(`File ${localeFile} is up-to-date`);
      }
    } else {
      fs.copyFileSync(baseFile, localeFile);
      console.info(`File ${localeFile} doesn't exist, created it with default values`);
    }
  }
}

/**
 * Adds all missing keys in the target object, considering the source object
 * @returns The number of added keys
 */
function addMissing(source, target) {
  let added = 0;
  for (const key of Object.keys(source)) {
    if (!target.hasOwnProperty(key)) {
      if (typeof source[key] === 'object') {
        // A nested object
        target[key] = {};
        added += addMissing(source[key], target[key]);
      } else {
        // A raw translation
        target[key] = source[key];
        added++;
      }
    } else if (typeof source[key] === 'object') {
      // Recurse into the nested object
      added += addMissing(source[key], target[key]);
    }
  }
  return added;
}

function removeStale(source, target) {
  let removed = 0;
  for (const key of Object.keys(target)) {
    if (!source.hasOwnProperty(key)) {
      if (typeof target[key] === 'object') {
        // A nested object
        removed += removeStale({}, target[key]);
      } else {
        // A raw translation
        removed++;
      }
      delete target[key];
    } else {
      // Recurse to neste object
      if (typeof target[key] === 'object') {
        removed += removeStale(source[key], target[key]);
      }
    }
  }
  return removed;
}

module.exports = mergeTranslations;