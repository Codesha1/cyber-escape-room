import { q } from '@/lib/db';
import { adminOnly } from '@/lib/admin';
import { audit, getSettings, json } from '@/lib/game';
import { readBody } from '@/lib/route';

export const dynamic = 'force-dynamic';

const FIELDS: Record<string, string> = {
  registration_open: 'التسجيل',
  play_open: 'اللعب',
  results_announced: 'إعلان النتائج',
};

export const POST = adminOnly(async (req: Request) => {
  const body = await readBody(req);
  for (const [k, label] of Object.entries(FIELDS)) {
    if (typeof body[k] !== 'boolean') continue;
    const v = body[k] as boolean;
    if (k === 'results_announced') {
      await q('UPDATE settings SET results_announced = $1, announced_at = CASE WHEN $1 THEN now() ELSE NULL END WHERE id = 1', [v]);
    } else if (k === 'play_open') {
      // إيقاف اللعب يوقف عدّاد الزمن لكل المشاركات
      await q('UPDATE settings SET play_open = $1 WHERE id = 1', [v]);
      if (!v) await q('UPDATE participants SET last_beat = NULL');
    } else {
      await q(`UPDATE settings SET ${k} = $1 WHERE id = 1`, [v]);
    }
    await audit('settings', { details: `${label}: ${v ? 'تشغيل' : 'إيقاف'}` });
  }
  return json({ ok: true, settings: await getSettings() });
});
