import { scryptSync } from 'node:crypto';
import { expect, it } from 'vitest';
import { derivePinVerifier } from './kdf';

it('matches independent Node scrypt with the exact v1 cost, leading-zero PIN and hexadecimal salt text', async () => {
  const salt = 'ab'.repeat(32);
  const expected = scryptSync('001234', salt, 32, {
    N: 65536,
    r: 8,
    p: 1,
    maxmem: 128 * 1024 * 1024,
  }).toString('hex');
  expect(await derivePinVerifier('001234', salt)).toBe(expected);
  expect(await derivePinVerifier('001235', salt)).not.toBe(expected);
}, 15000);
