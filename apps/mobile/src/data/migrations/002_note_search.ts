import type { Queries } from '../migrate';
import { foldSearchText } from '../search-text';

export async function backfillNoteSearch(db: Queries) {
  let cursor: string | undefined;
  for (;;) {
    const rows =
      cursor === undefined
        ? await db.getAllAsync<{ id: string; note: string | null }>(
            'SELECT id,note FROM transactions ORDER BY id LIMIT 100',
          )
        : await db.getAllAsync<{ id: string; note: string | null }>(
            'SELECT id,note FROM transactions WHERE id>? ORDER BY id LIMIT 100',
            cursor,
          );
    if (!rows.length) return;
    const cases = rows.map(() => 'WHEN ? THEN ?').join(' ');
    await db.runAsync(
      `UPDATE transactions SET note_search=CASE id ${cases} ELSE note_search END WHERE id IN (${rows.map(() => '?').join(',')})`,
      ...rows.flatMap((row) => [row.id, foldSearchText(row.note ?? '')]),
      ...rows.map((row) => row.id),
    );
    cursor = rows.at(-1)!.id;
  }
}
