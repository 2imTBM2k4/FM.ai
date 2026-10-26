import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { vi as messages } from './vi';

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory()
      ? sources(path)
      : /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.test.ts')
        ? [path]
        : [];
  });
}

it('all referenced Vietnamese catalog keys exist and have nonempty messages', () => {
  const keys = new Set(Object.keys(messages));
  for (const path of sources(resolve('apps/mobile/src'))) {
    for (const match of readFileSync(path, 'utf8').matchAll(/\bvi\.(\w+)/g)) {
      expect(keys.has(match[1]), `${path}: vi.${match[1]}`).toBe(true);
    }
  }
  for (const value of Object.values(messages))
    expect(value.trim().length).toBeGreaterThan(0);
});
