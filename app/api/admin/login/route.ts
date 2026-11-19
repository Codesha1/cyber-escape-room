import { NextResponse } from 'next/server';
import { checkAdminPassword, clientIp, makeAdminCookie, rateLimited } from '@/lib/auth';
import { audit, err } from '@/lib/game';
import { readBody, safe } from '@/lib/route';

export const dynamic = 'force-dynamic';

export const POST = safe(async (req: Request) => {
  if (rateLimited('admin:' + clientIp(req), 8, 5 * 60_000)) return err('محاولات كثيرة. انتظري 5 دقائق.', 429);
  const { password } = await readBody(req);
  if (!checkAdminPassword(password)) return err('كلمة المرور غير صحيحة.', 401);
  const res = NextResponse.json({ ok: true });
  makeAdminCookie(res);
  await audit('admin_login');
  return res;
});
