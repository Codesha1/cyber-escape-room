import { q } from '@/lib/db';
import { adminOnly } from '@/lib/admin';
import { getSettings, json, leaderboard, RANK_ORDER, score } from '@/lib/game';
import { QUESTIONS, TOTAL } from '@/lib/questions';
import type { Participant } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const GET = adminOnly(async () => {
  const [settings, people, attempts, log, lb] = await Promise.all([
    getSettings(),
    q<Participant>(`SELECT * FROM participants ORDER BY ${RANK_ORDER}`),
    q<{ participant_id: number; question_id: string; choice: string; correct: boolean; created_at: string }>(
      'SELECT participant_id, question_id, choice, correct, created_at FROM attempts ORDER BY created_at',
    ),
    q('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 200'),
    leaderboard(),
  ]);
  const byP = new Map<number, typeof attempts>();
  for (const a of attempts) {
    if (!byP.has(a.participant_id)) byP.set(a.participant_id, []);
    byP.get(a.participant_id)!.push(a);
  }
  const labels = Object.fromEntries(QUESTIONS.map((x) => [x.id, Object.fromEntries(x.options.map((o) => [o.id, o.label]))]));
  return json({
    settings,
    counts: lb.counts,
    total: TOTAL,
    questions: QUESTIONS.map((x, i) => ({ id: x.id, index: i + 1, room: x.room, text: x.text })),
    participants: people.map((p, i) => {
      const list = byP.get(p.id) || [];
      return {
        id: p.id, rank: i + 1, name: p.name, recoveryCode: p.recovery_code,
        createdAt: p.created_at, startedAt: p.started_at, finishedAt: p.finished_at,
        step: p.step, correct: p.correct_count, adjustment: p.adjustment, score: score(p),
        wrongAttempts: p.wrong_attempts, activeMs: Number(p.active_ms),
        perQuestion: QUESTIONS.map((x) => {
          const qa = list.filter((a) => a.question_id === x.id);
          const solved = qa.find((a) => a.correct);
          return {
            id: x.id,
            attempts: qa.length,
            wrong: qa.filter((a) => !a.correct).map((a) => labels[x.id][a.choice] || a.choice),
            solvedAt: solved?.created_at ?? null,
          };
        }),
      };
    }),
    log,
  });
});
