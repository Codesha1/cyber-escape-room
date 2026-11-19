import { q } from '@/lib/db';
import { currentPlayer } from '@/lib/auth';
import { err, getSettings, json } from '@/lib/game';
import { ACCUMULATE_SQL } from '@/lib/time';
import { readBody, safe } from '@/lib/route';

export const dynamic = 'force-dynamic';

// النبضة تُرسل كل 5 ثوانٍ والصفحة ظاهرة؛ وعند إخفاء الصفحة تُرسل visible=false لإيقاف العداد
export const POST = safe(async (req: Request) => {
  const p = await currentPlayer();
  if (!p) return err('سجّلي اسمك أولًا.', 401);
  let visible = true;
  try {
    const text = await req.text();
    if (text) visible = JSON.parse(text).visible !== false;
  } catch {}
  const s = await getSettings();
  const counting = visible && s.play_open;
  await q(
    `UPDATE participants SET active_ms = ${ACCUMULATE_SQL},
       last_beat = CASE WHEN $2 THEN now() ELSE NULL END
     WHERE id = $1 AND started_at IS NOT NULL AND finished_at IS NULL`,
    [p.id, counting],
  );
  return json({ ok: true, playOpen: s.play_open, resultsAnnounced: s.results_announced });
});
