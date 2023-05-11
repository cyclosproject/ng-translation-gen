/* eslint-disable */
/* tslint:disable */

import { BehaviorSubject } from 'rxjs';

/**
 * Container for translation values
 */
export type TranslationValues = { [key: string]: string | TranslationValues };

interface Target {
  initialized$: BehaviorSubject<boolean>;
  $values?: TranslationValues | string;
  $defaults?: TranslationValues | string;
  $children?: Map<string, Target>;
  $path: string | null;
}

/**
 * Handler for proxy calls
 */
const proxyHandler: ProxyHandler<any> = {
  apply(tx: Target, _this, args) {
    // Being invoked to replace args
    const value = actualValue(tx);
    return typeof value === 'string' ? replaceArgs(value, args) : value;
  },
  set() {
    return false;
  },
  get(tx: Target, nameOrSymbol) {
    switch (nameOrSymbol) {
      case '$path':
        return () => tx.$path;
      case 'initialized$':
        return tx.initialized$;
      case '$initialize':
        return (values: TranslationValues) => setValues(tx, values);
      case '$defaults':
        return (values: TranslationValues) => setDefaults(tx, values);
      case 'ngOnDestroy':
      case 'then':
        return undefined;
      case 'toString':
      case Symbol.toPrimitive:
        // This is called like a simple property
        return () => actualValue(tx);
      default:
        return getChild(tx, validIdentifier(nameOrSymbol));
    }
  },
};

function validIdentifier(name: string | symbol) {
  name = String(name);
  // more than one char in upper case is lower cased
  name = name.replace(/[A-Z]+/g, (match: string) => (match.length == 1 ? match : match.toLowerCase()));
  // each char after a '.', '_' or '-' is upper cased
  name = name.replace(/[\. | \_ | \-]\w{1}/g, (match: string) => match.substring(1).toUpperCase());
  return name;
}

function replaceArgs(value: string, args: any[]) {
  return value.replace(/\{\w+\}/g, (substring: string) => {
    if (args.length === 1 && typeof args[0] !== 'object') {
      return String(args[0]);
    }
    const paramName = substring.substring(1, substring.length - 1);
    if (/[0-9]+/.test(paramName)) {
      return String(args[parseInt(paramName, 10)]);
    } else {
      return String(args[0]?.[paramName] ?? '');
    }
  });
}

function actualValue(tx: Target, name?: string) {
  let result: TranslationValues | string | undefined;
  const values = tx.$values;
  if (values) {
    result =
      name && typeof values === 'object' ? values[name] : !name && typeof values === 'string' ? values : undefined;
  }
  if (!result) {
    const defaults = tx.$defaults;
    result =
      name && typeof defaults === 'object'
        ? defaults[name]
        : !name && typeof defaults === 'string'
          ? defaults
          : undefined;
  }
  if (!result) {
    const fullPath = [tx.$path, name].filter((p) => p).join('.');
    result = `???${fullPath}???`;
  }
  return result;
}

function ensureValidKeys(values: string | TranslationValues): void {
  if (typeof values !== 'object') {
    return;
  }
  const keys = Object.keys(values);
  for (const key of keys) {
    const valid = validIdentifier(key);
    if (key !== valid) {
      values[valid] = values[key];
    }
  }
}

function setValues(tx: Target, values: string | TranslationValues) {
  ensureValidKeys(values);
  tx.$values = values;
  if (typeof values === 'object') {
    const children = tx.$children;
    if (children) {
      for (const entry of children.entries()) {
        const name = entry[0];
        setValues(entry[1], values[name]);
      }
    }
  }
  tx.initialized$.next(true);
}

function setDefaults(tx: Target, defaults: string | TranslationValues) {
  ensureValidKeys(defaults);
  tx.$defaults = defaults;
  if (typeof defaults === 'object') {
    const children = tx.$children;
    if (children) {
      for (const entry of children.entries()) {
        const name = entry[0];
        setDefaults(entry[1], defaults[name]);
      }
    }
  }
}

function getChild(tx: Target, name: string) {
  let children = tx.$children;
  if (!children) {
    children = tx.$children = new Map();
  }
  let child = children.get(name);
  if (!child) {
    const pair = createProxy(tx.$path ? `${tx.$path}.${name}` : name);
    child = pair[1];
    const values = tx.$values;
    if (values && typeof values === 'object') {
      const nested = values[name];
      if (nested) {
        setValues(pair[0], nested);
      }
    }
    const defaults = tx.$defaults;
    if (defaults && typeof defaults === 'object') {
      const nested = defaults[name];
      if (nested) {
        setDefaults(pair[0], nested);
      }
    }
    children.set(name, child);
  }
  return child;
}

/**
 * Creates a proxy that behaves as the translations object
 */
export function createTranslations(): any {
  return createProxy(null)[1];
}

function createProxy(path: string | null) {
  const target = (() => null) as any as Target;
  target.initialized$ = new BehaviorSubject(false);
  target.$path = path;
  return [target, new Proxy<Target>(target, proxyHandler)] as const;
}
