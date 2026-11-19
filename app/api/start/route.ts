import { q } from '@/lib/db';
import { currentPlayer, type Participant } from '@/lib/auth';
import { err, getSettings, json, stateFor } from '@/lib/game';
import { safe } from '@/lib/route';

export const dynamic = 'force-dynamic';

export const POST = safe(async () => {
  const p = await currentPlayer();
  if (!p) return err('سجّلي اسمك أولًا.', 401);
  const s = await getSettings();
  if (!s.play_open && !p.finished_at) return err('المهمة لم تُفتح بعد. انتظري إشارة المعلمة.', 423);
  const rows = await q<Participant>(
    `UPDATE participants SET started_at = COALESCE(started_at, now()),
       last_beat = CASE WHEN finished_at IS NULL THEN now() ELSE NULL END
     WHERE id = $1 RETURNING *`,
    [p.id],
  );
  return json(await stateFor(rows[0]));
});
