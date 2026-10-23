import { createTranslator, keysOf } from '../translator';

const messages = {
  app: { name: 'Acme Credit' },
  purchase: { declined: 'Declined: {amount} is more than your available {available}.' },
};

describe('createTranslator', () => {
  const t = createTranslator(messages);

  it('resolves nested keys', () => {
    expect(t('app.name')).toBe('Acme Credit');
  });

  it('interpolates params and leaves unknown placeholders visible', () => {
    expect(t('purchase.declined', { amount: '$84.20', available: '$60.00' })).toBe(
      'Declined: $84.20 is more than your available $60.00.',
    );
    expect(t('purchase.declined', { amount: '$1.00' })).toBe(
      'Declined: $1.00 is more than your available {available}.',
    );
  });

  it('ignores inherited properties of the params object', () => {
    const tt = createTranslator({ x: 'Value: {constructor}' });
    expect(tt('x', {})).toBe('Value: {constructor}');
  });

  it('renders the key for a missing key or a namespace', () => {
    expect(t('app.missing')).toBe('app.missing');
    expect(t('app')).toBe('app');
    expect(t('app.name.deeper')).toBe('app.name.deeper');
  });
});

describe('keysOf', () => {
  it('lists every leaf key', () => {
    expect(keysOf(messages)).toEqual(['app.name', 'purchase.declined']);
  });
});
