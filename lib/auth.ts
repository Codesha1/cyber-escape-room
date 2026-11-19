import 'server-only';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { q } from './db';

export const PLAYER_COOKIE = 'cer_player';
export const ADMIN_COOKIE = 'cer_admin';

const secure = process.env.NODE_ENV === 'production';

export function sha256(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

export function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newRecoveryCode() {
  const b = crypto.randomBytes(6);
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[b[i] % CODE_ALPHABET.length];
  return `${s.slice(0, 3)}-${s.slice(3)}`;
}
export function normalizeCode(c: string) {
  const s = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s.length === 6 ? `${s.slice(0, 3)}-${s.slice(3)}` : '';
}

export function setPlayerCookie(res: NextResponse, token: string) {
  res.cookies.set(PLAYER_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 60 * 60 * 24 * 30,
  });
}

export type Participant = {
  id: number; name: string; recovery_code: string; created_at: string;
  started_at: string | null; finished_at: string | null; step: number;
  correct_count: number; wrong_attempts: number; active_ms: string; last_beat: string | null; adjustment: number;
};

export async function currentPlayer(): Promise<Participant | null> {
  const tok = (await cookies()).get(PLAYER_COOKIE)?.value;
  if (!tok || !/^[a-f0-9]{64}$/.test(tok)) return null;
  const rows = await q<Participant>('SELECT * FROM participants WHERE token_hash = $1', [sha256(tok)]);
  return rows[0] ?? null;
}

// ---------- الإدارة ----------
function secret() {
  const s = process.env.SESSION_SECRET || '';
  if (s.length < 16) throw new Error('SESSION_SECRET قصير أو غير مضبوط');
  return s;
}
function sign(payload: string) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('hex');
}
export function makeAdminCookie(res: NextResponse) {
  const exp = Date.now() + 12 * 60 * 60 * 1000;
  const payload = `admin.${exp}`;
  res.cookies.set(ADMIN_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true, sameSite: 'strict', secure, path: '/', maxAge: 12 * 60 * 60,
  });
}
export async function isAdmin(): Promise<boolean> {
  const v = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!v) return false;
  const parts = v.split('.');
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  if (Number(parts[1]) < Date.now()) return false;
  const a = Buffer.from(sign(payload));
  const b = Buffer.from(parts[2]);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export function checkAdminPassword(pw: string) {
  const real = process.env.ADMIN_PASSWORD || '';
  if (!real) return false;
  const a = Buffer.from(sha256(real));
  const b = Buffer.from(sha256(String(pw || '')));
  return crypto.timingSafeEqual(a, b);
}

// محدد بسيط لعدد المحاولات (لكل عنوان IP داخل نسخة الخادم)
const buckets = new Map<string, { n: number; t: number }>();
export function rateLimited(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.t > windowMs) { buckets.set(key, { n: 1, t: now }); return false; }
  b.n++;
  return b.n > max;
}
export function clientIp(req: Request) {
  return (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
}
