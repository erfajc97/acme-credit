import { demoSignUpValues } from '../helpers/demoValues';

const randomDemoPassword = () => demoSignUpValues(0, 'Demo').password;

/**
 * Demo sign-up data ships in the static bundle: a shared password literal there would be a known
 * credential for every demo account (P0 security), so each click draws a fresh one.
 */
describe('demo sign-up password', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is 20 characters with an upper case letter, a lower case letter, a digit and a symbol', () => {
    const password = randomDemoPassword();
    expect(password).toHaveLength(20);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[0-9]/);
    expect(password).toMatch(/[^A-Za-z0-9]/);
  });

  it('draws every character from crypto.getRandomValues', () => {
    const spy = vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => array);
    expect(randomDemoPassword()).toBe(`Aa2!${'A'.repeat(16)}`);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('differs on every call', () => {
    const passwords = new Set(Array.from({ length: 50 }, () => randomDemoPassword()));
    expect(passwords.size).toBe(50);
  });
});

describe('demoSignUpValues', () => {
  it('builds a unique e-mail from the click time and a fresh password per click', () => {
    const first = demoSignUpValues(1_761_000_000_000, 'Cliente Demo');
    const second = demoSignUpValues(1_761_000_000_001, 'Cliente Demo');
    expect(first).toMatchObject({
      fullName: 'Cliente Demo',
      email: 'demo+1761000000000@acme.test',
    });
    expect(second.email).toBe('demo+1761000000001@acme.test');
    expect(first.password).toHaveLength(20);
    expect(second.password).not.toBe(first.password);
  });
});
