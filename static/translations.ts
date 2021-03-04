/* tslint:disable */
import { BehaviorSubject } from 'rxjs';

/**
 * Container for translation values
 */
export type TranslationValues = { [key: string]: string | TranslationValues };

/**
 * Provides access to translation values
 */
export class Translations<I extends Object> {
  private ARGS_RE: RegExp = /\{\w+\}/g;
  private _obj: any;
  private _defaultValues: TranslationValues = {};
  private _values: TranslationValues = {};
  private _keys: string[] = [];
  private _nested = new Map<string, Translations<any>>();

  /** Indicates whether the translation values have been initialized **/
  initialized$ = new BehaviorSubject(false);

  constructor(public path?: string) {
    this._obj = {
      initialized$: this.initialized$,
      $initialize: (translations: { [key: string]: any }) => this.initialize(translations),
      $defaults: (defaults: { [key: string]: any }) => this.defaultValues = defaults
    };
  }

  /**
   * Returns the object that can be used to access the translations
   */
  object(): I {
    return this._obj as I;
  }

  /**
   * Initializes the translation values
   * @param values The translations values
   */
  initialize(values: any) {
    values = values || {};
    this._values = {} as TranslationValues;
    this._keys.length = 0;

    for (const prop of Object.keys(values)) {
      const valid = this.validProperty(prop);
      if (valid) {
        this._values[valid] = values[prop];
        const value = this._values[valid];
        if (typeof value === 'string') {
          this._keys.push(valid);
        } else if (typeof value === 'object') {
          const tx = this._nested.get(valid);
          if (tx) {
            tx.initialize(value);
          }
        }
      }
    }

    this.initialized$.next(true);
  }

  /**
   * Registers a simple property (no arguments)
   */
  simple(...properties: string[]) {
    const tx = this;
    (properties || []).forEach(p => {
      Object.defineProperty(this._obj, p, {
        enumerable: true,
        get: () => tx.get(p)
      });
    });
  }

  /**
   * Registers a property with a single argument (direct arg function)
   */
  named(property: string, mapping?: { [key: string]: string }) {
    const tx = this;
    this._obj[property] = (params: { [key: string]: any }) => {
      // We might need a remapping between the property and the actual key (example, if the key has a dot or dash)
      let args = params;
      if (params && mapping) {
        // We'll need to mutate the params
        args = { ...args };
        const key = mapping[property] || property;
        if (key && key !== property) {
          args[property] = args[key];
        }
      }
      return tx.get(property, args);
    };
  }

  /**
   * Registers a property with multiple arguments (receives an object)
   */
  positional(property: string, mapping?: string) {
    const tx = this;
    this._obj[property] = (...params: any[]) => {
      const args: { [key: string]: any } = {};
      params = params || [];
      if (mapping) {
        // The only possible case for a mapping is a single positiona param with a key
        args[mapping] = params;
      } else {
        for (let i = 0; i < params.length; i++) {
          args[String(i)] = params[i];
        }
      }
      return tx.get(property, args);
    };
  }

  /**
   * Registers a nested translations object
   */
  nested(...txs: Translations<any>[]) {
    txs.forEach(tx => {
      const p = this.getValidIdentifier(tx.path);
      this._nested.set(p, tx);
      Object.defineProperty(this._obj, p, {
        enumerable: true,
        get: () => {
          return tx.object();
        }
      });
    });
  }

  /**
   * Sets the default values, which work as a fallback for missing keys
   */
  set defaultValues(defaultValues: any) {
    defaultValues = defaultValues || {};
    this._defaultValues = {} as TranslationValues;
    for (const key of Object.keys(defaultValues)) {
      const valid = this.validProperty(key);
      if (valid) {
        this._defaultValues[valid] = defaultValues[key];
      }
    }
    this._nested.forEach((tx, property) => tx.defaultValues = defaultValues[property])
  }

  /**
   * Returns an array with all translation keys.
   */
  get keys(): string[] {
    return this._keys;
  }

  /**
   * Returns the value associated to the given key without argument interpolation
   */
  rawValue(key: string): string | undefined {
    const value = this._values[key] || this._defaultValues[key];
    return typeof value === 'string' ? value : undefined;
  }

  /**
   * Translates a message key, applying the given parameters
   * @param key The message key
   * @param params The parameters
   */
  get(key: string, params: { [key: string]: any } = {}): string {
    const value = this.rawValue(key);
    if (value == null) {
      return `???${this.path ? this.path + '.' + key : key}???`;
    } else {
      return value.replace(this.ARGS_RE, (substring: string) => {
        const paramName = substring.substring(1, substring.length - 1);
        return String(params[paramName]);
      });
    }
  }

  // Both regexp are used to get the method name from the translation key.
  // E.g: error.Invalid -> errorInvalid
  private static UPPER_CASE_REG_EXP = /[A-Z]+/g;
  private static METHOD_REG_EXP = /[\. | \_ | \-]\w{1}/g;

  private getValidIdentifier(name: any) {
    name = String(name);
    // more than one char in upper case is lower cased
    name = name.replace(Translations.UPPER_CASE_REG_EXP, (match: string) => match.length == 1 ? match : match.toLowerCase());
    // each char after a '.', '_' or '-' is upper cased
    name = name.replace(Translations.METHOD_REG_EXP, (match: string) => match.substring(1).toUpperCase());
    return name;
  }

  private validProperty(name: string) {
    name = this.getValidIdentifier(name);
    return this._obj.hasOwnProperty(name) ? name : null;
  }
}
