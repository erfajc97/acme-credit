// Turns .env.example into a first-run .env (used by scripts/up.mjs). Every `<generate>` gets a
// fresh random value per machine, so no shared secret or demo password ever exists:
// - a key ending in _PASSWORD gets a human-typable password (someone types it into a sign-in form);
// - any other key gets a 48-character url-safe secret.
// `<same:KEY>` copies the value of a KEY defined above it, so the public demo-fill values match
// the users the seed creates.
import { randomBytes, randomInt } from 'node:crypto';

const GENERATE = '<generate>';
const SAME_AS = /^<same:([A-Z0-9_]+)>$/;
const ASSIGNMENT = /^([A-Z0-9_]+)=(.*?)(\r?)$/;

// Look-alikes (0/O, 1/l/I) left out; symbols limited to ones that need no quoting in .env files,
// compose interpolation ($) or a shell paste.
const PASSWORD_CLASSES = [
  'ABCDEFGHJKLMNPQRSTUVWXYZ',
  'abcdefghijkmnpqrstuvwxyz',
  '23456789',
  '!@%+._-',
];
const PASSWORD_LENGTH = 20;

const pick = (alphabet) => alphabet.charAt(randomInt(alphabet.length));

/** One character of each class first (any password policy accepts it), the rest from all. */
function typablePassword() {
  const any = PASSWORD_CLASSES.join('');
  return Array.from({ length: PASSWORD_LENGTH }, (_, position) =>
    pick(PASSWORD_CLASSES[position] ?? any),
  ).join('');
}

const randomSecret = () => randomBytes(36).toString('base64url');

export function renderEnvTemplate(template) {
  const values = new Map();
  return template
    .split('\n')
    .map((line) => {
      const assignment = ASSIGNMENT.exec(line);
      if (!assignment) return line;
      const [, key, raw, eol] = assignment;
      const value = resolveValue({ key, raw, values });
      values.set(key, value);
      return `${key}=${value}${eol}`;
    })
    .join('\n');
}

function resolveValue({ key, raw, values }) {
  if (raw === GENERATE) return key.endsWith('_PASSWORD') ? typablePassword() : randomSecret();
  const mirror = SAME_AS.exec(raw);
  if (!mirror) return raw;
  const source = mirror[1];
  if (!values.has(source))
    throw new Error(`${key} mirrors ${source}, which is not defined above it`);
  return values.get(source);
}
