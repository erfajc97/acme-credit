import { demoLogin } from '../demo-login';

/**
 * The "Use demo account" button ships whatever this returns in the static bundle, so a production
 * build (demo mode off, values empty) must get nothing to fill (P0 security).
 */
describe('demoLogin', () => {
  const values = { email: 'demo@example.test', password: 'built-from-env' };

  it('returns the login only when demo mode is on and both values are present', () => {
    expect(demoLogin({ enabled: true, ...values })).toEqual(values);
  });

  it('demo mode off hides it even when values were baked in', () => {
    expect(demoLogin({ enabled: false, ...values })).toBeNull();
  });

  it.each([
    ['no email', { ...values, email: '' }],
    ['no password', { ...values, password: '' }],
    ['a blank email', { ...values, email: '   ' }],
    ['a blank password', { ...values, password: '  ' }],
  ])('demo mode on with %s has nothing to fill', (_case, partial) => {
    expect(demoLogin({ enabled: true, ...partial })).toBeNull();
  });
});
