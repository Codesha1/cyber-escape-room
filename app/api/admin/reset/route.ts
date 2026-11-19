import { q } from '@/lib/db';
import { adminOnly, requireReason } from '@/lib/admin';
import { audit, err, json } from '@/lib/game';
import { readBody } from '@/lib/route';

export const dynamic = 'force-dynamic';

// بدء جولة جديدة: حذف جميع المشاركات وإلغاء الإعلان
export const POST = adminOnly(async (req: Request) => {
  const body = await readBody(req);
  const reason = requireReason(body.reason);
  if (!reason) return err('السبب إلزامي (3 أحرف على الأقل).');
  if (String(body.confirm || '').trim() !== 'حذف الكل') return err('اكتبي «حذف الكل» للتأكيد.');
  const n = (await q<{ n: string }>('SELECT count(*) AS n FROM participants'))[0].n;
  await q('DELETE FROM participants');
  await q('UPDATE settings SET results_announced = false, announced_at = NULL WHERE id = 1');
  await audit('reset', { details: `حذف ${n} مشاركة`, reason });
  return json({ ok: true });
});
