/** C0 controls and DEL: browsers silently drop tabs and newlines inside a URL. */
function hasControlChar(text: string): boolean {
  return [...text].some((char) => {
    const code = char.codePointAt(0) ?? 0;
    return code < 0x20 || code === 0x7f;
  });
}

/**
 * The same-origin path a `returnTo` / `next` value may send the browser to, or null (W14).
 * The value is attacker-controlled, so it is resolved the way the browser will resolve it
 * (`new URL(value, ownOrigin)`) and must land on `ownOrigin`; prefix checks miss `/\t/evil.com`
 * and `/\evil.com`, which browsers read as `//evil.com`. Only a path is accepted (it starts
 * with "/"), any control character is refused, and the RESOLVED path is returned, never the
 * raw text. Shared by every front-end that reads a return address (G12).
 */
export function safeReturnPath(value: string | null, ownOrigin: string): string | null {
  if (!value?.startsWith('/') || hasControlChar(value)) return null;
  let url: URL;
  try {
    url = new URL(value, ownOrigin);
  } catch {
    return null; // unparseable: no safe address to go back to
  }
  if (url.origin !== new URL(ownOrigin).origin) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
