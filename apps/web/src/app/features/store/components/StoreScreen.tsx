import {
  AmountText,
  AppSheet,
  ButtonLink,
  EmptyState,
  ErrorState,
  SegmentedFilter,
} from '@acme/ui';
import { ListHeading } from '@/app/components/ListHeading';
import { ListPager } from '@/app/components/ListPager';
import { PageSkeleton } from '@/app/components/PageSkeleton';
import { t } from '@/app/i18n';
import { useStorePage } from '../hooks/useStorePage';
import { CartBar } from './CartBar';
import { CartPanel } from './CartPanel';
import { ProductCard } from './ProductCard';
import { SwitchCartDialog } from './SwitchCartDialog';

/**
 * The store: filter chips and the product grid (compact cards that fill columns of at least 10.5rem:
 * 2 on phones, 3 to 5 on wider screens), 10 per numbered page (`?page=`). The chip rows scroll
 * sideways (ChipScroller). From lg the cart panel stands next to the grid, sticky while the page
 * scrolls; the grid never scrolls inside. Phones: the cart is a sheet behind a bottom bar.
 */
export function StoreScreen() {
  const page = useStorePage();
  const { cart } = page;
  if (page.isLoading) return <PageSkeleton label={t('store.loading')} />;
  if (page.isError) {
    return (
      <ErrorState
        title={t('account.loadFailedTitle')}
        body={t('account.loadFailedBody')}
        retryLabel={t('common.retry')}
        retryingLabel={t('common.retrying')}
        onRetry={page.retry}
        isRetrying={page.isRetrying}
      />
    );
  }
  if (!page.hasCard) {
    return (
      <EmptyState
        title={t('store.noCardTitle')}
        body={t('store.noCardBody')}
        action={<ButtonLink href={page.walletHref}>{t('common.backToAccount')}</ButtonLink>}
      />
    );
  }
  const cartPanel = (showTitle: boolean) => (
    <CartPanel
      merchantName={cart.merchantName}
      lines={cart.lines}
      items={cart.items}
      total={cart.total}
      isEmpty={cart.isEmpty}
      checkoutHref={page.checkoutHref}
      onQuantityChange={cart.setQuantity}
      onRemove={cart.remove}
      onClear={cart.clear}
      showTitle={showTitle}
    />
  );
  return (
    <div className="flex flex-col gap-5 pb-20 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8 lg:pb-0 2xl:grid-cols-[minmax(0,1fr)_24rem]">
      <p aria-live="polite" className="sr-only">
        {page.announcement}
      </p>
      <div className="flex min-w-0 flex-col gap-4">
        <p className="inline-flex flex-wrap items-baseline gap-x-2 self-start rounded-control bg-cream px-4 py-2 text-small">
          <span className="text-muted">{t('store.available')}</span>
          <span className="font-medium">
            <AmountText value={page.available} />
          </span>
        </p>
        <SegmentedFilter
          label={t('store.merchantsLabel')}
          options={page.filters.merchantOptions}
          value={page.filters.merchant}
          onChange={page.filters.setMerchant}
          scroll={page.filters.merchantScroll}
        />
        <SegmentedFilter
          label={t('store.categoriesLabel')}
          options={page.filters.categoryOptions}
          value={page.filters.category}
          onChange={page.filters.setCategory}
          scroll={page.filters.categoryScroll}
        />
        <ListHeading bind={page.bindProductsHeading} className="sr-only">
          {t('store.productsTitle')}
        </ListHeading>
        {page.products.length === 0 ? (
          <EmptyState
            headingLevel={3}
            title={t('store.noProductsTitle')}
            body={t('store.noProductsBody')}
          />
        ) : (
          <ul
            data-tour="store-products"
            aria-label={t('store.pageTitle')}
            className="grid scroll-mt-24 grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-3 pb-1 lg:gap-4"
          >
            {page.products.map((product) => (
              <ProductCard
                key={product.sku}
                product={product}
                onAdd={page.productActions.add}
                onQuantityChange={cart.setQuantity}
                onRemove={page.productActions.remove}
              />
            ))}
          </ul>
        )}
        <ListPager pager={page.pager} />
      </div>
      <aside
        aria-label={t('store.cart.title')}
        className="hidden min-h-0 flex-col rounded-card border-[1.6px] border-ink bg-surface-raised p-5 shadow-raised lg:sticky lg:top-6 lg:flex lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:overflow-y-auto"
      >
        {cartPanel(true)}
      </aside>
      {!cart.isEmpty && (
        <CartBar items={cart.items} total={cart.total} onOpen={cart.sheet.onOpen} />
      )}
      <AppSheet
        isOpen={cart.sheet.isOpen}
        onOpenChange={cart.sheet.onOpenChange}
        title={t('store.cart.title')}
        closeLabel={t('common.close')}
      >
        {cartPanel(false)}
      </AppSheet>
      <SwitchCartDialog
        isOpen={cart.switchDialog.isOpen}
        onOpenChange={cart.switchDialog.onOpenChange}
        current={cart.switchDialog.current}
        next={cart.switchDialog.next}
        items={cart.items}
        onConfirm={cart.switchDialog.confirm}
      />
    </div>
  );
}
