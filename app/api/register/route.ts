import { NextResponse } from 'next/server';
import { q } from '@/lib/db';
import { clientIp, newRecoveryCode, newToken, rateLimited, setPlayerCookie, sha256, type Participant } from '@/lib/auth';
import { cleanName, err, getSettings, nameKey, stateFor } from '@/lib/game';
import { readBody, safe } from '@/lib/route';

export const dynamic = 'force-dynamic';

export const POST = safe(async (req: Request) => {
  if (rateLimited('reg:' + clientIp(req), 60, 60_000)) return err('محاولات كثيرة، انتظري دقيقة ثم حاولي.', 429);
  const settings = await getSettings();
  if (!settings.registration_open) return err('التسجيل مغلق حاليًا. انتظري إشارة المعلمة.', 423);

  const body = await readBody(req);
  const c = cleanName(body.name);
  if (!c.ok) return err(c.error);
  const key = nameKey(c.name);
  const token = newToken();

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newRecoveryCode();
    try {
      const rows = await q<Participant>(
        `INSERT INTO participants (name, name_key, recovery_code, token_hash)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [c.name, key, code, sha256(token)],
      );
      const res = NextResponse.json({ ok: true, ...(await stateFor(rows[0])) }, { headers: { 'Cache-Control': 'no-store' } });
      setPlayerCookie(res, token);
      return res;
    } catch (e: any) {
      if (e?.code === '23505') {
        if (String(e.constraint || '').includes('name_key')) {
          return err('هذا الاسم مسجَّل من قبل. إن كنتِ سجّلتِ سابقًا فاستخدمي رمز الاستعادة، أو أضيفي اسم العائلة.', 409);
        }
        continue; // تصادم نادر في رمز الاستعادة
      }
      throw e;
    }
  }
  return err('تعذر إنشاء رمز الاستعادة، حاولي مرة أخرى.', 500);
});
