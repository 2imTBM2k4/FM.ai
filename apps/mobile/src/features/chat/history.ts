import type { ChatRow } from '@/data/repository';

// Match SQLite's timestamp/id order and deduplicate messages already shown locally.
export function mergeChatMessages(
  current: ChatRow[],
  incoming: ChatRow[],
): ChatRow[] {
  return [
    ...new Map([...current, ...incoming].map((row) => [row.id, row])).values(),
  ].sort((left, right) => {
    if (left.created_at !== right.created_at)
      return left.created_at > right.created_at ? -1 : 1;
    return left.id === right.id ? 0 : left.id > right.id ? -1 : 1;
  });
}
