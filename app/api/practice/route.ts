import { currentPlayer } from '@/lib/auth';
import { err, json } from '@/lib/game';
import { publicQuestion, QUESTIONS } from '@/lib/questions';
import { readBody, safe } from '@/lib/route';

export const dynamic = 'force-dynamic';

// وضع التدريب: متاح فقط لمن أكملت المهمة، ولا يغيّر نتيجتها المسجلة
export const GET = safe(async () => {
  const p = await currentPlayer();
  if (!p?.finished_at) return err('وضع التدريب متاح بعد إكمال المهمة.', 403);
  return json({ questions: QUESTIONS.map((_, i) => publicQuestion(i)) });
});

export const POST = safe(async (req: Request) => {
  const p = await currentPlayer();
  if (!p?.finished_at) return err('وضع التدريب متاح بعد إكمال المهمة.', 403);
  const { questionId, choice } = await readBody(req);
  const qn = QUESTIONS.find((x) => x.id === questionId);
  if (!qn || !qn.options.some((o) => o.id === choice)) return err('اختاري إحدى الإجابات.');
  const correct = qn.correct === choice;
  return json({ correct, message: correct ? qn.success : qn.wrong });
});
