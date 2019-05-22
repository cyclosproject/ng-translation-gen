/* tslint:disable */

/**
 * Container for translation values
 */
export type TranslationValues = { [key: string]: string | TranslationValues };

/**
 * Provides access to translation values
 */
export class Translations {
  private ARGS_RE: RegExp = /\{\w+\}/g;
  private NUMERICAL_ARGS_RE: RegExp = /\d+/;

  private _defaultValues: TranslationValues = {};
  private _values: TranslationValues = {};
  private _keys: string[] = [];

  constructor(private _path?: string) {
  }

  /**
   * Initializes the translation values
   * @param values The translations values
   */
  initialize(values: Object) {
    this._values = (values || {}) as TranslationValues;
    this._keys.length = 0;

    for (const prop of Object.keys(this._values)) {
      const value = this._values[prop];
      if (typeof value === 'string') {
        this._keys.push(prop);
      }
    }
  }

  /**
   * Sets the default values, which work as a fallback for missing keys
   */
  set defaultValues(defaultValues: Object) {
    this._defaultValues = (defaultValues || {}) as TranslationValues;
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
  rawValue(key: string): string {
    const value = this._values[key] || this._defaultValues[key];
    return typeof value === 'string' ? value : undefined;
  }

  /**
   * Translates a message key, applying the given parameters
   * @param key The message key
   * @param params The parameters
   */
  get(key: string, params: Object = {}): string {
    const value = this.rawValue(key);
    if (value == null) {
      return `???${this._path ? this._path + '.' + key : key}???`;
    } else {
      return value.replace(this.ARGS_RE, (substring: string) => {
        let paramName = substring.substring(1, substring.length - 1);
        // e.g in case of {0} the corresponding property is arg0
        if (this.NUMERICAL_ARGS_RE.test(paramName)) {
          paramName = 'arg' + paramName;
        }
        return String(params[paramName]);
      });
    }
  }
}
