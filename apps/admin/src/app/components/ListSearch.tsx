import { SearchField } from '@acme/ui';
import { useListSearch } from '@/app/hooks/useListSearch';
import { t } from '@/app/i18n';

interface ListSearchProps {
  /** Unique per page: names the field (`name`, so autofill and DevTools see a named field). */
  name: string;
  label: string;
  placeholder: string;
  /** The URL's `q` ('' = none). */
  urlText: string;
  onSearch: (text: string) => void;
}

/** The one search box of every admin list (debounced, Enter submits, clear button). */
export function ListSearch({ name, label, placeholder, urlText, onSearch }: ListSearchProps) {
  const search = useListSearch({ urlText, onSearch });
  return (
    <SearchField
      name={name}
      label={label}
      placeholder={placeholder}
      clearLabel={t('search.clear')}
      value={search.value}
      onChange={search.onChange}
      onSubmit={search.onSubmit}
      onClear={search.onClear}
      maxLength={search.maxLength}
      errorMessage={search.errorMessage}
    />
  );
}
