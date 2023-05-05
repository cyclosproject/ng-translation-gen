/* eslint-disable */
/* tslint:disable */

import { BehaviorSubject } from "rxjs";

/**
 * Container for translation values
 */
export type TranslationValues = { [key: string]: string | TranslationValues };

/**
 * Handler for proxy calls
 */
const proxyHandler: ProxyHandler<any> = {
  set() {
    return false;
  },
  get(tx, nameOrSymbol) {
    switch (nameOrSymbol) {
      case 'initialized$':
        return () => { return tx.initialized$ };
      case '$initialize':
        return (values: TranslationValues) => { tx.values = values };
      case '$defaults':
        return (values: TranslationValues) => { tx.defaults = values };
      case 'ngOnDestroy':
        return () => { };
    }
    const hasValue = tx.values?.hasOwnProperty(nameOrSymbol);
    const hasDefault = tx.defaults?.hasOwnProperty(nameOrSymbol);
    const name = String(nameOrSymbol);
    if (hasValue || hasDefault) {
      // Is a valid property
      const rawValue = tx.values?.[name];
      const defaultValue = tx.defaults?.[name];
      const value = rawValue ?? defaultValue;
      if (typeof value === 'object') {
        // Is a nested object. Return a nested proxy.
        let nested = tx.children.get(name)
        if (!nested) {
          const txAndProxy = doCreateTranslations(tx, name);
          const nestedTx = txAndProxy[0];
          if (typeof rawValue === 'object') {
            nestedTx.values = rawValue;
          }
          if (typeof defaultValue === 'object') {
            nestedTx.defaults = defaultValue;
          }
          nested = txAndProxy[1];
          tx.children.set(name, nested);
        }
        return nested;
      } else {
        const translated = String(value);
        // Is a raw value. May be either a simple getter or a method
        const result = (...args: any[]) => {
          // When invoked as a function, replace parameters
          return translated.replace(/\{\w+\}/g, (substring: string) => {
            const paramName = substring.substring(1, substring.length - 1);
            if (/[0-9]+/.test(paramName)) {
              return String(args[parseInt(paramName, 10)]);
            } else {
              return String(args[0]?.[paramName] ?? '');
            }
          });
        };
        // When used directly, have the toString returning the raw value
        result.toString = () => translated;
        return result;
      }
    } else {
      // Is invalid. Return a placeholder.
      const fullName = tx.fullName;
      return `???${fullName ? fullName + '.' : ''}${name}???`
    }
  }
};

/**
 * Contains values, and are the backing object of proxies
 */
export class TranslationHolder {
  constructor(
    public parent?: TranslationHolder,
    public name?: string) {
  }
  _values?: TranslationValues;
  _defaults?: TranslationValues;
  initialized = new BehaviorSubject(false);
  children = new Map<string, TranslationHolder>();

  get values(): TranslationValues | undefined {
    return this._values;
  }

  set values(v: TranslationValues | undefined) {
    this._values = v;
    if (v) {
      for (const e of this.children.entries()) {
        const name = e[0];
        const sub = v[name];
        if (sub && typeof sub === 'object') {
          e[1].values = sub;
        }
      }
    }
  }

  get defaults(): TranslationValues | undefined {
    return this._defaults;
  }

  set defaults(v: TranslationValues | undefined) {
    this._defaults = v;
    if (v) {
      for (const e of this.children.entries()) {
        const name = e[0];
        const sub = v[name];
        if (sub && typeof sub === 'object') {
          e[1].defaults = sub;
        }
      }
    }
  }

  get fullName() {
    const parts: string[] = [];
    let curr: TranslationHolder | undefined = this;
    while (curr) {
      if (curr.name) {
        parts.unshift(curr.name);
      }
      curr = curr.parent;
    }
    return parts.length === 0 ? undefined : parts.join('.');
  }
}

/**
 * Creates a proxy that behaves as the translations object
 */
export function createTranslations(): any {
  return doCreateTranslations(undefined, undefined)[1];
}

function doCreateTranslations(parent?: TranslationHolder, name?: string) {
  const tx = new TranslationHolder(parent, name);
  return [tx, new Proxy(tx, proxyHandler)] as const;
}
