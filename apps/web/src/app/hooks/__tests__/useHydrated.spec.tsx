import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { useHydrated } from '../useHydrated';

function Probe() {
  return <span>{useHydrated() ? 'ready' : 'server'}</span>;
}

describe('useHydrated (mount gate without an effect)', () => {
  it('is false in the server HTML and true once hydrated, with no recoverable error', async () => {
    const html = renderToString(<Probe />);
    expect(html).toContain('server');
    const container = document.createElement('div');
    container.innerHTML = html;
    const errors: unknown[] = [];
    await act(async () => {
      hydrateRoot(container, <Probe />, { onRecoverableError: (error) => errors.push(error) });
    });
    expect(container.textContent).toBe('ready');
    expect(errors).toEqual([]);
  });
});
