/** Look-alike characters (0/O, 1/l/I) are left out so a demo password can be read back aloud. */
const CHARACTER_CLASSES = [
  'ABCDEFGHJKLMNPQRSTUVWXYZ',
  'abcdefghijkmnopqrstuvwxyz',
  '23456789',
  '!#%+-=?@',
];
const ANY_CHARACTER = CHARACTER_CLASSES.join('');
const GENERATED_PASSWORD_LENGTH = 20;

/**
 * A fresh strong password per demo sign-up (crypto.getRandomValues), never a shared literal: a
 * literal in the bundle would be a known password for every demo account. The first characters
 * cover each class so any password policy accepts it; the rest come from all of them.
 */
function randomDemoPassword(): string {
  const draws = crypto.getRandomValues(new Uint32Array(GENERATED_PASSWORD_LENGTH));
  return Array.from(draws, (draw, position) => {
    const alphabet = CHARACTER_CLASSES[position] ?? ANY_CHARACTER;
    return alphabet.charAt(draw % alphabet.length);
  }).join('');
}

/**
 * Test data for the sign-up form in demo mode: a unique e-mail per click (the timestamp, so
 * "email taken" never blocks a demo), a random password and a display name in the page language.
 */
export function demoSignUpValues(now: number, fullName: string) {
  return { fullName, email: `demo+${now}@acme.test`, password: randomDemoPassword() };
}
