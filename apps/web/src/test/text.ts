/** es-MX money has a no-break space after "USD" (Intl); compare it as a plain space. */
export const plain = (text: string | null | undefined): string =>
  (text ?? '').replace(/\u00a0/g, ' ');
