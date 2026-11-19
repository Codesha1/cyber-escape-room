import { q } from '@/lib/db';
import { json } from '@/lib/game';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, boolean> = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    ADMIN_PASSWORD: !!process.env.ADMIN_PASSWORD,
    SESSION_SECRET: (process.env.SESSION_SECRET || '').length >= 16,
    database: false,
  };
  let error: string | undefined;
  try {
    await q('SELECT 1 FROM settings WHERE id = 1');
    checks.database = true;
  } catch (e: any) {
    error = 'تعذر الاتصال بقاعدة البيانات، تحققي من DATABASE_URL';
    console.error('[health]', e?.message);
  }
  const ok = Object.values(checks).every(Boolean);
  return json({ ok, checks, ...(error ? { error } : {}) }, ok ? 200 : 503);
}
