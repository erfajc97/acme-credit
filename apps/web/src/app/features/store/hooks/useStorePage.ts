import { STORE_CATALOG, STORE_CATEGORIES, STORE_MERCHANTS } from '@acme/contracts';
import type { SegmentedOption } from '@acme/ui';
import { useState } from 'react';
import { formatAmount } from '@/app/helpers/money';
import { localHref } from '@/app/helpers/navigation';
import { LIST_PAGE_PARAMS, paginate } from '@/app/helpers/pageParam';
import { useListPager } from '@/app/hooks/useListPager';
import { getActiveLocale, t } from '@/app/i18n';
import { ROUTES } from '@/app/lib/endpoints';
import { useAccountQuery } from '@/app/tanstack-queries/accountQuery';
import {
  ALL,
  CATEGORY_LABEL,
  EAGER_PRODUCT_IMAGES,
  MERCHANT_IDS,
  productImageSrc,
  type CategoryFilter,
  type MerchantFilter,
} from '../data';
import type { ProductFocusTarget, ProductView } from '../types';
import { useStoreCart } from './useStoreCart';

const MERCHANT_OPTIONS: SegmentedOption[] = MERCHANT_IDS.map((id) => ({
  value: id,
  label: STORE_MERCHANTS[id].name,
}));

/**
 * The in-wallet store: filters (merchant, category), the product grid in the page locale and the
 * cart. Shopping needs an active or frozen card (a frozen card is declined by the network at
 * checkout, which then says why).
 */
export function useStorePage() {
  const account = useAccountQuery();
  const cart = useStoreCart();
  const pager = useListPager(LIST_PAGE_PARAMS.store);
  const [merchant, setMerchant] = useState<MerchantFilter>(ALL);
  const [category, setCategory] = useState<CategoryFilter>(ALL);
  // Focus follows the customer's own add/remove (the control they pressed is replaced); the live
  // region says what happened. A filter change clears it so a remounted card never steals focus.
  const [focus, setFocus] = useState<{ sku: string; target: ProductFocusTarget } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const language = getActiveLocale() === 'en-US' ? 'en' : 'es';
  const data = account.data;

  const shown = paginate(
    STORE_CATALOG.filter(
      (product) =>
        (merchant === ALL || product.merchant === merchant) &&
        (category === ALL || product.category === category),
    ),
    pager.page,
  );
  const products: ProductView[] = shown.items.map((product, index) => ({
    sku: product.sku,
    category: product.category,
    merchantName: STORE_MERCHANTS[product.merchant].name,
    name: product.name[language],
    description: product.description[language],
    price: formatAmount(product.priceCents),
    imageSrc: productImageSrc(product.sku),
    imageLoading: index < EAGER_PRODUCT_IMAGES ? 'eager' : 'lazy',
    quantity: cart.quantities[product.sku] ?? 0,
    autoFocus: focus?.sku === product.sku ? focus.target : null,
  }));
  const pagerView = pager.view({
    query: { data: shown, isPlaceholderData: false },
    nav: t('store.pagesLabel'),
  });
  // New filter, new results: they start on their first page (the old page number means nothing).
  const firstPage = () => {
    if (pager.page !== 1) pager.setPage(1);
  };
  const nameOf = (sku: string) => products.find((product) => product.sku === sku)?.name ?? '';

  return {
    isLoading: account.isLoading,
    isError: account.isError,
    // refetch never rejects: a failure lands in the query state, shown by the error branch.
    retry: () => void account.refetch(),
    isRetrying: account.isFetching,
    hasCard: data?.status === 'ACTIVE' || data?.status === 'FROZEN',
    available: data ? formatAmount(data.availableCents) : '',
    filters: {
      merchantScroll: {
        previousLabel: t('store.merchantsPrevious'),
        nextLabel: t('store.merchantsNext'),
      },
      categoryScroll: {
        previousLabel: t('store.categoriesPrevious'),
        nextLabel: t('store.categoriesNext'),
      },
      merchantOptions: [{ value: ALL, label: t('store.allMerchants') }, ...MERCHANT_OPTIONS],
      categoryOptions: [
        { value: ALL, label: t('store.allCategories') },
        ...STORE_CATEGORIES.map((value) => ({ value, label: t(CATEGORY_LABEL[value]) })),
      ],
      merchant,
      category,
      setMerchant: (value: string) => {
        setFocus(null);
        firstPage();
        setMerchant(value as MerchantFilter);
      },
      setCategory: (value: string) => {
        setFocus(null);
        firstPage();
        setCategory(value as CategoryFilter);
      },
    },
    products,
    pager: pagerView,
    bindProductsHeading: pager.bindHeading,
    productActions: {
      add: (sku: string) => {
        if (!cart.add(sku)) return;
        setFocus({ sku, target: 'stepper' });
        setAnnouncement(t('store.added', { product: nameOf(sku) }));
      },
      remove: (sku: string) => {
        cart.remove(sku);
        setFocus({ sku, target: 'add' });
        setAnnouncement(t('store.removed', { product: nameOf(sku) }));
      },
    },
    announcement,
    cart,
    checkoutHref: localHref(ROUTES.checkout),
    walletHref: localHref(ROUTES.app),
  };
}
