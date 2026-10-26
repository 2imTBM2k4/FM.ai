import { expect, it } from 'vitest';
import { mergeChatMessages } from './history';

it('keeps tied timestamps stable and merges a repeated page or a message sent after the clock moved back', () => {
  const a = {
    id: 'a',
    text: 'Synthetic A',
    created_at: '2026-10-26T00:00:00Z',
  };
  const b = { ...a, id: 'b' };
  const older = { ...a, id: 'c', created_at: '2026-10-25T00:00:00Z' };
  expect(mergeChatMessages([a, older], [b, older]).map(({ id }) => id)).toEqual(
    ['b', 'a', 'c'],
  );
  expect(mergeChatMessages([a], [older, b]).map(({ id }) => id)).toEqual([
    'b',
    'a',
    'c',
  ]);
});
