import { cookies } from 'next/headers';
import { tx } from '@/lib/db';
import { PLAYER_COOKIE, sha256, type Participant } from '@/lib/auth';
import { err, json, stateFor } from '@/lib/game';
import { QUESTIONS, TOTAL } from '@/lib/questions';
import { ACCUMULATE_SQL } from '@/lib/time';
import { readBody, safe } from '@/lib/route';

export const dynamic = 'force-dynamic';

type Outcome =
  | { kind: 'error'; message: string; status: number }
  | { kind: 'stale'; p: Participant }
  | { kind: 'answered'; p: Participant; correct: boolean; message: string };

export const POST = safe(async (req: Request) => {
  const tok = (await cookies()).get(PLAYER_COOKIE)?.value;
  if (!tok || !/^[a-f0-9]{64}$/.test(tok)) return err('سجّلي اسمك أولًا.', 401);
  const body = await readBody(req);
  const questionId = String(body.questionId || '');
  const choice = String(body.choice || '');

  const out: Outcome = await tx(async (c) => {
    // قفل صف المشاركة يمنع احتساب السؤال نفسه مرتين عند الإرسال المتزامن
    const p = (await c.query<Participant>('SELECT * FROM participants WHERE token_hash = $1 FOR UPDATE', [sha256(tok)])).rows[0];
    if (!p) return { kind: 'error', message: 'سجّلي اسمك أولًا.', status: 401 };
    const s = (await c.query('SELECT play_open FROM settings WHERE id = 1')).rows[0];
    if (!s.play_open) return { kind: 'error', message: 'المهمة متوقفة مؤقتًا من المعلمة.', status: 423 };
    if (!p.started_at) return { kind: 'error', message: 'ابدئي المهمة أولًا.', status: 409 };
    if (p.finished_at) return { kind: 'stale', p };

    const cur = QUESTIONS[p.step];
    if (!cur || cur.id !== questionId) return { kind: 'stale', p };
    if (!cur.options.some((o) => o.id === choice)) return { kind: 'error', message: 'اختاري إحدى الإجابات.', status: 400 };

    const correct = choice === cur.correct;
    await c.query('INSERT INTO attempts (participant_id, question_id, choice, correct) VALUES ($1,$2,$3,$4)', [p.id, cur.id, choice, correct]);
    const finishing = correct && p.step + 1 >= TOTAL;
    const updated = (await c.query<Participant>(
      `UPDATE participants SET
         active_ms = ${ACCUMULATE_SQL},
         last_beat = CASE WHEN $2 THEN NULL ELSE now() END,
         step = step + $3,
         correct_count = correct_count + $3,
         wrong_attempts = wrong_attempts + $4,
         finished_at = CASE WHEN $2 THEN now() ELSE finished_at END
       WHERE id = $1 RETURNING *`,
      [p.id, finishing, correct ? 1 : 0, correct ? 0 : 1],
    )).rows[0];
    return { kind: 'answered', p: updated, correct, message: correct ? cur.success : cur.wrong };
  });

  if (out.kind === 'error') return err(out.message, out.status);
  const state = await stateFor(out.p);
  if (out.kind === 'stale') return json({ stale: true, ...state });
  return json({ correct: out.correct, message: out.message, ...state });
});
