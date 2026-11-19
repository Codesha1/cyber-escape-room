import { NextResponse } from 'next/server';
import { q } from '@/lib/db';
import { clientIp, newToken, normalizeCode, rateLimited, setPlayerCookie, sha256, type Participant } from '@/lib/auth';
import { err, stateFor } from '@/lib/game';
import { readBody, safe } from '@/lib/route';

export const dynamic = 'force-dynamic';

export const POST = safe(async (req: Request) => {
  if (rateLimited('restore:' + clientIp(req), 20, 60_000)) return err('محاولات كثيرة، انتظري دقيقة ثم حاولي.', 429);
  const code = normalizeCode((await readBody(req)).code);
  if (!code) return err('رمز الاستعادة مكوّن من 6 خانات، مثل: ABC-123');
  const token = newToken();
  const rows = await q<Participant>(
    'UPDATE participants SET token_hash = $1, last_beat = NULL WHERE recovery_code = $2 RETURNING *',
    [sha256(token), code],
  );
  if (!rows[0]) return err('لم نجد مشاركة بهذا الرمز. تأكدي من كتابته بشكل صحيح.', 404);
  const res = NextResponse.json({ ok: true, ...(await stateFor(rows[0])) }, { headers: { 'Cache-Control': 'no-store' } });
  setPlayerCookie(res, token);
  return res;
});
