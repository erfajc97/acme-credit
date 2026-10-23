import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { listHref } from '@/app/helpers/listMemory';
import { AUDIT_LIST } from '@/app/helpers/listQuery';
import { setActiveLocale, t } from '@/app/i18n';
import { ACCOUNT_ID, auditEntryFixture, page } from '@/test/fixtures';
import { apiError, core, json, server, signedIn } from '@/test/server';
import AuditLog from '../AuditLog';

// These specs pin the English copy and US formats; Purchases.spec covers the es-MX default.
beforeEach(() => setActiveLocale('en-US'));

const user = userEvent.setup();

function auditApi(answer: (entityId: string | null) => Response) {
  const seen: (string | null)[] = [];
  server.use(
    signedIn,
    http.get(core('/admin/audit-log'), ({ request }) => {
      const entityId = new URL(request.url).searchParams.get('entityId');
      seen.push(entityId);
      return answer(entityId);
    }),
  );
  return seen;
}

describe('AuditLog island', () => {
  it('lists who did what to which entity, with the request id', async () => {
    auditApi(() => json(page([auditEntryFixture()])));
    window.history.replaceState(null, '', '/audit-log');
    render(<AuditLog locale="en-US" />);
    const row = within(await screen.findByRole('table', { name: t('audit.caption') })).getAllByRole(
      'row',
    )[1] as HTMLElement;
    expect(row).toHaveTextContent('account.frozen');
    expect(row).toHaveTextContent(t('actor.admin'));
    expect(row).toHaveTextContent('req-7f3a');
    expect(within(row).getByRole('link', { name: '5f3e2d1c' })).toHaveAttribute(
      'href',
      `/en/accounts/view?id=${ACCOUNT_ID}`,
    );
  });

  it('filters by entity id in the URL, remembers it, and Back clears it again', async () => {
    const seen = auditApi((entityId) =>
      entityId ? json(page([])) : json(page([auditEntryFixture()])),
    );
    window.history.replaceState(null, '', '/audit-log');
    render(<AuditLog locale="en-US" />);
    await screen.findByRole('table', { name: t('audit.caption') });
    await user.type(screen.getByLabelText(t('auditLog.filter.label')), `  ${ACCOUNT_ID} `);
    await user.click(screen.getByRole('button', { name: t('auditLog.filter.submit') }));
    expect(window.location.search).toBe(`?entityId=${ACCOUNT_ID}`);
    expect(await screen.findByText(t('auditLog.emptyFilteredTitle'))).toBeInTheDocument();
    expect(seen).toEqual([null, ACCOUNT_ID]);
    expect(listHref(AUDIT_LIST)).toBe(`/audit-log?entityId=${ACCOUNT_ID}`);

    act(() => {
      window.history.back();
    });
    await vi.waitFor(() => expect(window.location.search).toBe(''));
    expect(await screen.findByRole('table', { name: t('audit.caption') })).toBeInTheDocument();
    expect(screen.getByLabelText(t('auditLog.filter.label'))).toHaveValue('');
  });

  it('validates the filter like the API (required, at most 64 characters) before sending', async () => {
    const seen = auditApi(() => json(page([auditEntryFixture()])));
    window.history.replaceState(null, '', '/audit-log?entityId=acc-1');
    render(<AuditLog locale="en-US" />);
    const box = await screen.findByLabelText(t('auditLog.filter.label'));
    expect(box).toHaveValue('acc-1');
    expect(box).toHaveAttribute('maxlength', '64');
    await user.clear(box);
    await user.click(screen.getByRole('button', { name: t('auditLog.filter.submit') }));
    expect(await screen.findByText(t('validation.entityIdRequired'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('auditLog.filter.clear') }));
    expect(window.location.search).toBe('');
    await vi.waitFor(() => expect(seen).toEqual(['acc-1', null]));
  });

  it('shows the empty trail and an error with retry', async () => {
    let fail = true;
    auditApi(() => (fail ? apiError(500, 'common.internal') : json(page([]))));
    window.history.replaceState(null, '', '/audit-log');
    render(<AuditLog locale="en-US" />);
    const alert = await screen.findByRole('alert', {}, { timeout: 4000 });
    expect(alert).toHaveTextContent(t('auditLog.loadFailedTitle'));
    fail = false;
    await user.click(within(alert).getByRole('button', { name: t('common.retry') }));
    expect(await screen.findByText(t('auditLog.emptyTitle'))).toBeInTheDocument();
  });
});

describe('AuditLog search', () => {
  it('searches next to the entity filter, both in the address, and clearing the search keeps the filter', async () => {
    const seen: string[] = [];
    server.use(
      signedIn,
      http.get(core('/admin/audit-log'), ({ request }) => {
        const params = new URL(request.url).searchParams;
        seen.push(params.toString());
        return json(params.get('q') === 'nope' ? page([]) : page([auditEntryFixture()]));
      }),
    );
    window.history.replaceState(null, '', `/en/audit-log?entityId=${ACCOUNT_ID}&page=2`);
    render(<AuditLog locale="en-US" />);
    await user.type(await screen.findByLabelText(t('search.auditLog.label')), 'nope{Enter}');
    expect(window.location.search).toBe(`?entityId=${ACCOUNT_ID}&q=nope`);
    expect(await screen.findByText('No results for “nope”')).toBeInTheDocument();
    expect(seen.at(-1)).toBe(`entityId=${ACCOUNT_ID}&q=nope&page=1&pageSize=10`);
    await user.click(screen.getByRole('button', { name: t('search.clearAction') }));
    expect(window.location.search).toBe(`?entityId=${ACCOUNT_ID}`);
  });
});

describe('AuditLog filter and search together', () => {
  it('applying the entity filter keeps the current search', async () => {
    server.use(
      signedIn,
      http.get(core('/admin/audit-log'), () => json(page([auditEntryFixture()]))),
    );
    window.history.replaceState(null, '', '/en/audit-log?q=freeze');
    render(<AuditLog locale="en-US" />);
    await user.type(await screen.findByLabelText(t('auditLog.filter.label')), ACCOUNT_ID);
    await user.click(screen.getByRole('button', { name: t('auditLog.filter.submit') }));
    expect(window.location.search).toBe(`?entityId=${ACCOUNT_ID}&q=freeze`);
  });
});
