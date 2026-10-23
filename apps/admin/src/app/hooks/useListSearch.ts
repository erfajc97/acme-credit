import { useEffect, useEffectEvent, useState } from 'react';
import { LIST_SEARCH_MAX } from '@/app/helpers/listQuery';
import { VALIDATION_PARAMS } from '@/app/helpers/validationParams';
import { t } from '@/app/i18n';

/** The list follows the search box this long after the last keystroke (one request per pause). */
export const SEARCH_DEBOUNCE_MS = 300;

interface ListSearchOptions {
  /** The URL's `q` ('' = none): the box follows it on Back/Forward and "clear". */
  urlText: string;
  /** Writes the new `q` ('' = none) through the list's own URL writer (page back to 1). */
  onSearch: (text: string) => void;
}

/**
 * The search box of every admin list: the list follows it 300 ms after the last keystroke, at once
 * on Enter, and the clear button (or Esc) drops the search. It sends the trimmed text, and only
 * when it differs from the URL's `q` (a trailing space or a second Enter is not a new search, nor
 * a new history entry). Longer than the API's cap (1–100 characters) says why under the box and
 * never reaches the URL.
 */
export function useListSearch({ urlText, onSearch }: ListSearchOptions) {
  const [text, setText] = useState(urlText);
  const [shownUrlText, setShownUrlText] = useState(urlText);
  // Back/Forward or an empty state's "clear" changed the URL: the box shows it (derived in render).
  if (shownUrlText !== urlText) {
    setShownUrlText(urlText);
    if (text.trim() !== urlText) setText(urlText);
  }
  const isTooLong = text.trim().length > LIST_SEARCH_MAX;

  const search = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length > LIST_SEARCH_MAX || trimmed === urlText) return;
    onSearch(trimmed);
  };
  // Reads the latest URL text and callback without restarting the debounce on every render.
  const commit = useEffectEvent(search);

  useEffect(() => {
    // Debounce timer (W3: a timer, not a request; the list's query reacts to the URL).
    const timer = window.setTimeout(() => commit(text), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [text]);

  return {
    value: text,
    onChange: setText,
    onSubmit: search,
    onClear: () => {
      setText('');
      search('');
    },
    maxLength: LIST_SEARCH_MAX,
    errorMessage: isTooLong ? t('validation.searchTooLong', VALIDATION_PARAMS) : undefined,
  };
}
