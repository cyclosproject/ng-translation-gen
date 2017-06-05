import { Injectable } from '@angular/core';


export type Translations = { [key: string]: string };

export abstract class BaseMessages {
  private ARGS_RE: RegExp = /\{\w+\}/g;
  private NUMERICAL_ARGS_RE: RegExp = /\d+/;
  
  private translations: Translations;

  initialize(translations: Translations) {
    this.translations = translations;
  }

  /**
   * Retrun an array with all translation keys. 
   */
  properties(): string[] {
    let keys : string[] = [];
    for (let p in this.translations) {
      keys.push(p);
    }

    return keys;
  }

  /**
   * Retrun the value associated to the given key without argument replacement.
   * This method could be used in conjunction with properties() to inspect the current translations.
   */
  rawValue(key: string): string {
    return this.translations[key];
  }

  protected translate(key: string, keyArgs: Object): string {
    let value = <string>this.translations[key]
    if (value === undefined) {
      return `???${key}???`;
    } else {
      return value.replace(this.ARGS_RE, (substring: string, ...args: any[]) => {
        let paramName = substring.substring(1, substring.length - 1);
        // e.g in case of {0} the corresponding property is arg0
        if (this.NUMERICAL_ARGS_RE.test(paramName)) { 
          paramName = "arg" + paramName;
        }
        return keyArgs[paramName];
      });
    }
  }
}