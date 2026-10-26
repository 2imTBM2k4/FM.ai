import { expect, it } from 'vitest';
import { createLogger } from './logger';

it('permits fixed lock diagnostic categories but rejects arbitrary native error text', () => {
  const output: unknown[] = [];
  const log = createLogger((entry) => output.push(entry));
  log('error', {
    route: 'lock',
    status: 'failed',
    errorCode: 'LOCK_STORAGE_WRITE_FAILED',
    nativeReason: 'INTERACTION_NOT_ALLOWED',
  });
  expect(output).toHaveLength(1);
  expect(() => log('error', { nativeReason: 'SECRET_SENTINEL' })).toThrow(
    'LOG_FIELD_REJECTED',
  );
  expect(output).toHaveLength(1);
});

it('writes operational fields and rejects sensitive or nested content', () => {
  const output: unknown[] = [];
  const log = createLogger((entry) => output.push(entry));
  log('info', { route: 'startup', status: 'ready', latency: 12 });
  expect(output).toEqual([
    { level: 'info', route: 'startup', status: 'ready', latency: 12 },
  ]);
  for (const field of [
    'note',
    'amount',
    'question',
    'pin',
    'text',
    'walletName',
    'error',
  ]) {
    expect(() => log('error', { [field]: 'SENTINEL_PRIVATE_TEXT' })).toThrow(
      'LOG_FIELD_REJECTED',
    );
  }
  expect(() =>
    log('error', { errorCode: { question: 'SENTINEL_PRIVATE_TEXT' } }),
  ).toThrow();
  expect(() => log('info', { status: 'SENTINEL_PRIVATE_TEXT' })).toThrow();
  expect(output).toHaveLength(1);
});
