import 'server-only';

// الأسئلة الثلاثة كما وردت حرفيًا في متطلبات الدرس. الإجابات الصحيحة لا تغادر الخادم أبدًا.
export type Option = { id: string; label: string; text: string };
type Q = {
  id: string;
  room: 1 | 2;
  text: string;
  options: Option[];
  correct: string;
  success: string;
  wrong: string;
};

const WRONG_GENERAL = 'ليست هذه الإجابة الصحيحة، حاولي مرة أخرى أيتها المبرمجة!';

export const QUESTIONS: Q[] = [
  {
    id: 'q1',
    room: 1,
    text: 'ما وظيفة لبنة (كرّر) في سكراتش؟',
    options: [
      { id: 'a', label: 'أ', text: 'تنفيذ الأوامر لعدد محدد من المرات.' },
      { id: 'b', label: 'ب', text: 'إيقاف البرنامج نهائيًا.' },
      { id: 'c', label: 'ج', text: 'تغيير لون الكائن.' },
      { id: 'd', label: 'د', text: 'حذف جميع الأوامر.' },
    ],
    correct: 'a',
    success: 'ممتاز! لقد نجحتِ في حل أول تحدٍ برمجي',
    wrong: WRONG_GENERAL,
  },
  {
    id: 'q2',
    room: 1,
    text: 'أين توجد لبنة (كرّر) في سكراتش؟',
    options: [
      { id: 'a', label: 'أ', text: 'فئة الحركة.' },
      { id: 'b', label: 'ب', text: 'فئة المظاهر.' },
      { id: 'c', label: 'ج', text: 'فئة التحكم.' },
      { id: 'd', label: 'د', text: 'فئة الصوت.' },
    ],
    correct: 'c',
    success: 'أحسنتن! تم اجتياز الغرفة الأولى بنجاح',
    wrong: WRONG_GENERAL,
  },
  {
    id: 'q3',
    room: 2,
    text: 'إذا أردتِ أن ينفذ الكائن الأمر نفسه 10 مرات، فما اللبنة المناسبة؟',
    options: [
      { id: 'a', label: 'أ', text: 'انتظر 10 ثوانٍ.' },
      { id: 'b', label: 'ب', text: 'كرّر 10 مرات.' },
      { id: 'c', label: 'ج', text: 'توقف الكل.' },
      { id: 'd', label: 'د', text: 'تحرك 10 خطوات.' },
    ],
    correct: 'b',
    success: 'مذهل! لقد نجحتِ في حل التحدي النهائي!',
    wrong: 'اقتربتِ من الحل! فكري في اللبنة التي تسمح بتكرار الأوامر عدة مرات، ثم حاولي مجددًا.',
  },
];

export const TOTAL = QUESTIONS.length;

export function publicQuestion(step: number) {
  const q = QUESTIONS[step];
  if (!q) return null;
  return { id: q.id, room: q.room, index: step + 1, text: q.text, options: q.options };
}
