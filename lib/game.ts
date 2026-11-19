import 'server-only';
import { NextResponse } from 'next/server';
import { q } from './db';
import { publicQuestion, TOTAL } from './questions';
import type { Participant } from './auth';

export type Settings = {
  registration_open: boolean; play_open: boolean; results_announced: boolean; announced_at: string | null;
};

export async function getSettings(): Promise<Settings> {
  const r = await q<Settings>('SELECT registration_open, play_open, results_announced, announced_at FROM settings WHERE id = 1');
  return r[0];
}

// توحيد الاسم: يمنع تكرار الاسم نفسه بصيغة إملائية مختلفة
export function nameKey(name: string) {
  return String(name)
    .normalize('NFKC')
    .replace(/[ً-ٰٟۖ-ۭ]/g, '') // التشكيل
    .replace(/ـ/g, '') // التطويل
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function cleanName(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
  const name = String(raw ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (name.length < 2) return { ok: false, error: 'اكتبي اسمك (حرفان على الأقل).' };
  if (name.length > 30) return { ok: false, error: 'الاسم طويل جدًا، اكتبيه في 30 حرفًا أو أقل.' };
  if (!/^[\p{L}\p{M}\s'\-.]+$/u.test(name)) return { ok: false, error: 'استخدمي الحروف فقط في الاسم.' };
  if (!nameKey(name)) return { ok: false, error: 'اكتبي اسمًا صحيحًا.' };
  return { ok: true, name };
}

export function score(p: Pick<Participant, 'correct_count' | 'adjustment'>) {
  return Math.max(0, Math.min(TOTAL, p.correct_count + p.adjustment));
}

export function publicMe(p: Participant | null) {
  if (!p) return null;
  const finished = !!p.finished_at;
  return {
    name: p.name,
    recoveryCode: p.recovery_code,
    started: !!p.started_at,
    finished,
    step: p.step,
    correct: p.correct_count,
    total: TOTAL,
    roomsDone: p.step >= 3 ? 2 : p.step >= 2 ? 1 : 0,
    progress: p.step >= 3 ? 100 : p.step >= 2 ? 50 : 0,
    activeMs: Number(p.active_ms),
  };
}

export async function stateFor(p: Participant | null) {
  const settings = await getSettings();
  return {
    settings: {
      registrationOpen: settings.registration_open,
      playOpen: settings.play_open,
      resultsAnnounced: settings.results_announced,
    },
    me: publicMe(p),
    question: p && !p.finished_at ? publicQuestion(p.step) : null,
  };
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}
export function err(message: string, status = 400) {
  return json({ error: message }, status);
}

export const RANK_ORDER = `
  (CASE WHEN finished_at IS NOT NULL THEN 0 ELSE 1 END),
  GREATEST(0, LEAST(${TOTAL}, correct_count + adjustment)) DESC,
  active_ms ASC, wrong_attempts ASC, finished_at ASC NULLS LAST, id ASC`;

export async function leaderboard() {
  const settings = await getSettings();
  const counts = (await q<{ registered: string; playing: string; finished: string }>(`
    SELECT count(*) AS registered,
           count(*) FILTER (WHERE started_at IS NOT NULL AND finished_at IS NULL) AS playing,
           count(*) FILTER (WHERE finished_at IS NOT NULL) AS finished
    FROM participants`))[0];
  const base = {
    announced: settings.results_announced,
    counts: { registered: +counts.registered, playing: +counts.playing, finished: +counts.finished },
  };
  if (!settings.results_announced) return { ...base, rows: [] as any[] };
  const rows = await q<Participant>(`SELECT * FROM participants ORDER BY ${RANK_ORDER}`);
  return {
    ...base,
    announcedAt: settings.announced_at,
    rows: rows.map((p, i) => ({
      rank: i + 1,
      name: p.name,
      score: score(p),
      total: TOTAL,
      finished: !!p.finished_at,
      activeMs: Number(p.active_ms),
    })),
  };
}

export async function audit(action: string, opts: { id?: number | null; name?: string | null; details?: string; reason?: string } = {}) {
  await q('INSERT INTO audit_log (action, participant_id, participant_name, details, reason) VALUES ($1,$2,$3,$4,$5)', [
    action, opts.id ?? null, opts.name ?? null, opts.details ?? null, opts.reason ?? null,
  ]);
}
