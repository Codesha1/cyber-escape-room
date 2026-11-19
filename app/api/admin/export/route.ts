import { q } from '@/lib/db';
import { adminOnly } from '@/lib/admin';
import { RANK_ORDER, score } from '@/lib/game';
import { QUESTIONS, TOTAL } from '@/lib/questions';
import type { Participant } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const TZ = process.env.APP_TIMEZONE || 'Asia/Riyadh';
function fmt(d: string | Date | null) {
  if (!d) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date(d)).replace(',', '');
}
function dur(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function cell(v: unknown) {
  let s = String(v ?? '');
  if (/^[=+\-@]/.test(s)) s = "'" + s; // حماية من حقن الصيغ في Excel
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const GET = adminOnly(async () => {
  const people = await q<Participant>(`SELECT * FROM participants ORDER BY ${RANK_ORDER}`);
  const attempts = await q<{ participant_id: number; question_id: string; correct: boolean }>('SELECT participant_id, question_id, correct FROM attempts');
  const head = ['الترتيب', 'الاسم', 'الدرجة', 'من', 'الحالة', 'زمن اللعب (دقيقة:ثانية)', 'المحاولات الخاطئة',
    ...QUESTIONS.map((_, i) => `محاولات السؤال ${i + 1}`), 'تعديل يدوي', 'وقت التسجيل', 'وقت البدء', 'وقت الانتهاء', 'رمز الاستعادة'];
  const lines = [head.map(cell).join(',')];
  people.forEach((p, i) => {
    lines.push([
      i + 1, p.name, score(p), TOTAL, p.finished_at ? 'مكتملة' : p.started_at ? 'لم تكتمل' : 'لم تبدأ',
      dur(Number(p.active_ms)), p.wrong_attempts,
      ...QUESTIONS.map((x) => attempts.filter((a) => a.participant_id === p.id && a.question_id === x.id).length),
      p.adjustment || '', fmt(p.created_at), fmt(p.started_at), fmt(p.finished_at), p.recovery_code,
    ].map(cell).join(','));
  });
  const csv = '﻿' + lines.join('\r\n');
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="cyber-escape-results-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
});
