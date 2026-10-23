/** A message tree: nested namespaces ending in strings with optional `{name}` placeholders. */
export interface Messages {
  [key: string]: string | Messages;
}

export type TranslateParams = Record<string, string | number>;

export type Translate = (key: string, params?: TranslateParams) => string;

function lookup(messages: Messages, key: string): string | undefined {
  let node: string | Messages | undefined = messages;
  for (const part of key.split('.')) {
    if (typeof node !== 'object') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * Builds `t('ns.key', { amount })` for one locale (G13, W12). A missing key renders the key
 * itself so it is visible in review; the locale key-set test keeps that from shipping.
 */
export function createTranslator(messages: Messages): Translate {
  return (key, params) => {
    const template = lookup(messages, key);
    if (template === undefined) return key;
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      Object.hasOwn(params, name) ? String(params[name]) : match,
    );
  };
}

/** Every leaf key of a message tree, for the "same keys in every locale" test. */
export function keysOf(messages: Messages, prefix = ''): string[] {
  return Object.entries(messages).flatMap(([name, value]) => {
    const key = prefix ? `${prefix}.${name}` : name;
    return typeof value === 'string' ? [key] : keysOf(value, key);
  });
}
