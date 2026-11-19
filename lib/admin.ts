import 'server-only';
import { isAdmin } from './auth';
import { err } from './game';
import { safe } from './route';

export function adminOnly<A extends any[]>(fn: (...a: A) => Promise<Response>) {
  return safe(async (...a: A) => {
    if (!(await isAdmin())) return err('يلزم تسجيل الدخول إلى لوحة الإدارة.', 401);
    return fn(...a);
  });
}

export function requireReason(r: unknown): string | null {
  const s = String(r ?? '').trim();
  return s.length >= 3 ? s.slice(0, 300) : null;
}
