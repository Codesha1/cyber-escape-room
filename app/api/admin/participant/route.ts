import { q } from '@/lib/db';
import { adminOnly, requireReason } from '@/lib/admin';
import { audit, err, json, score } from '@/lib/game';
import { TOTAL } from '@/lib/questions';
import { readBody } from '@/lib/route';
import type { Participant } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const POST = adminOnly(async (req: Request) => {
  const body = await readBody(req);
  const id = Number(body.id);
  const reason = requireReason(body.reason);
  if (!Number.isInteger(id)) return err('مشاركة غير معروفة.');
  if (!reason) return err('السبب إلزامي (3 أحرف على الأقل).');
  const p = (await q<Participant>('SELECT * FROM participants WHERE id = $1', [id]))[0];
  if (!p) return err('لم يتم العثور على المشاركة.', 404);

  if (body.action === 'delete') {
    await q('DELETE FROM participants WHERE id = $1', [id]);
    await audit('delete', { id, name: p.name, details: `الدرجة قبل الحذف ${score(p)}/${TOTAL}`, reason });
    return json({ ok: true });
  }
  if (body.action === 'adjust') {
    const target = Number(body.score);
    if (!Number.isInteger(target) || target < 0 || target > TOTAL) return err(`الدرجة يجب أن تكون بين 0 و ${TOTAL}.`);
    await q('UPDATE participants SET adjustment = $2 - correct_count WHERE id = $1', [id, target]);
    await audit('adjust', { id, name: p.name, details: `من ${score(p)} إلى ${target} من ${TOTAL}`, reason });
    return json({ ok: true });
  }
  return err('إجراء غير معروف.');
});
