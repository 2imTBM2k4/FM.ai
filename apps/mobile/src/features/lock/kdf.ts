import { scryptAsync } from '@noble/hashes/scrypt.js';
import { bytesToHex } from '@noble/hashes/utils.js';

// PinRecord v1 fixes these costs and treats its hexadecimal salt as UTF-8 text.
export async function derivePinVerifier(pin: string, salt: string) {
  return bytesToHex(
    await scryptAsync(pin, salt, {
      N: 65536,
      r: 8,
      p: 1,
      dkLen: 32,
      maxmem: 128 * 1024 * 1024,
      asyncTick: 8,
    }),
  );
}
