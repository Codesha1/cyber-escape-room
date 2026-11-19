'use client';
import { Fragment, useCallback, useEffect, useState } from 'react';

type P = {
  id: number; rank: number; name: string; recoveryCode: string; createdAt: string; startedAt: string | null; finishedAt: string | null;
  step: number; correct: number; adjustment: number; score: number; wrongAttempts: number; activeMs: number;
  perQuestion: { id: string; attempts: number; wrong: string[]; solvedAt: string | null }[];
};
type Overview = {
  settings: { registration_open: boolean; play_open: boolean; results_announced: boolean; announced_at: string | null };
  counts: { registered: number; playing: number; finished: number };
  total: number;
  questions: { id: string; index: number; room: number; text: string }[];
  participants: P[];
  log: { id: number; action: string; participant_name: string | null; details: string | null; reason: string | null; created_at: string }[];
};

const t = (d: string | null) => (d ? new Date(d).toLocaleString('ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: 'numeric', month: 'short' }) : '—');
const dur = (ms: number) => { const s = Math.round(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const ACTION: Record<string, string> = { settings: 'إعدادات', delete: 'حذف مشاركة', adjust: 'تصحيح درجة', reset: 'جولة جديدة', admin_login: 'دخول الإدارة' };

async function post(path: string, body: unknown) {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data: d };
}

export default function Admin() {
  const [auth, setAuth] = useState<'unknown' | 'no' | 'yes'>('unknown');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [ov, setOv] = useState<Overview | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [modal, setModal] = useState<null | { kind: 'delete' | 'adjust' | 'reset'; p?: P }>(null);
  const [reason, setReason] = useState('');
  const [newScore, setNewScore] = useState(3);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/overview', { cache: 'no-store' });
    if (r.status === 401) { setAuth('no'); return; }
    if (!r.ok) { setErr('تعذر تحميل البيانات.'); return; }
    setOv(await r.json()); setAuth('yes');
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (auth !== 'yes') return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [auth, load]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    const r = await post('/api/admin/login', { password: pw });
    if (!r.ok) { setErr(r.data.error || 'تعذر الدخول.'); return; }
    setPw(''); load();
  };
  const toggle = async (k: keyof Overview['settings'], v: boolean) => {
    setBusy(true);
    await post('/api/admin/settings', { [k]: v });
    setBusy(false); load();
  };
  const runModal = async () => {
    if (!modal) return;
    setBusy(true); setErr('');
    const r = modal.kind === 'reset'
      ? await post('/api/admin/reset', { reason, confirm: confirmText })
      : await post('/api/admin/participant', { action: modal.kind, id: modal.p!.id, reason, score: newScore });
    setBusy(false);
    if (!r.ok) { setErr(r.data.error || 'تعذر التنفيذ.'); return; }
    setModal(null); setReason(''); setConfirmText(''); load();
  };

  if (auth === 'unknown') return <main className="admin"><div className="loader" /></main>;
  if (auth === 'no') {
    return (
      <main className="admin admin-login">
        <form className="panel glass a-card" onSubmit={login}>
          <div className="eyebrow">ADMIN CONSOLE</div>
          <h1 className="h2">لوحة إدارة المعلمة</h1>
          <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="كلمة المرور" autoFocus />
          <button className="btn btn-primary btn-lg">دخول</button>
          {err ? <p className="err">{err}</p> : null}
        </form>
      </main>
    );
  }
  if (!ov) return null;
  const S = ov.settings;
  return (
    <main className="admin">
      <header className="a-head">
        <div>
          <div className="eyebrow">ADMIN CONSOLE</div>
          <h1 className="a-title">CYBER ESCAPE ROOM — لوحة الإدارة</h1>
        </div>
        <div className="a-links">
          <a className="btn btn-ghost" href="/leaderboard" target="_blank" rel="noreferrer">شاشة المتصدرين</a>
          <a className="btn btn-ghost" href="/" target="_blank" rel="noreferrer">فتح اللعبة</a>
          <button className="btn btn-ghost" onClick={async () => { await post('/api/admin/logout', {}); setAuth('no'); }}>خروج</button>
        </div>
      </header>

      <section className="a-row">
        <div className="a-stat glass"><b>{ov.counts.registered}</b><span>مسجّلة</span></div>
        <div className="a-stat glass"><b>{ov.counts.playing}</b><span>تلعب الآن</span></div>
        <div className="a-stat glass"><b>{ov.counts.finished}</b><span>أكملت</span></div>
      </section>

      <section className="a-controls glass">
        <Toggle label="التسجيل" on={S.registration_open} disabled={busy} onChange={(v) => toggle('registration_open', v)} hint="السماح بتسجيل أسماء جديدة" />
        <Toggle label="اللعب" on={S.play_open} disabled={busy} onChange={(v) => toggle('play_open', v)} hint="عند الإيقاف تتوقف اللعبة ويتوقف عدّاد الزمن" />
        <Toggle label="إعلان النتائج" on={S.results_announced} disabled={busy} onChange={(v) => toggle('results_announced', v)} hint="يبدأ حفل الكشف على كل الشاشات المفتوحة" />
        <div className="a-actions">
          <a className="btn btn-primary" href="/api/admin/export">تصدير CSV</a>
          <button className="btn btn-danger" onClick={() => { setErr(''); setModal({ kind: 'reset' }); }}>جولة جديدة (حذف الكل)</button>
        </div>
      </section>

      <section className="glass a-table-wrap">
        <table className="a-table">
          <thead>
            <tr><th>#</th><th>الاسم</th><th>الحالة</th><th>الدرجة</th><th>الزمن</th><th>أخطاء</th><th>البدء</th><th>الانتهاء</th><th>الرمز</th><th></th></tr>
          </thead>
          <tbody>
            {ov.participants.length === 0 ? <tr><td colSpan={10} className="muted center">لا توجد مشاركات بعد.</td></tr> : null}
            {ov.participants.map((p) => (
              <Fragment key={p.id}>
                <tr className={open === p.id ? 'is-open' : ''} onClick={() => setOpen(open === p.id ? null : p.id)}>
                  <td>{p.rank}</td>
                  <td className="strong">{p.name}</td>
                  <td>{p.finishedAt ? <span className="tag tag-ok">مكتملة</span> : p.startedAt ? <span className="tag tag-warn">تلعب • سؤال {p.step + 1}</span> : <span className="tag">لم تبدأ</span>}</td>
                  <td>{p.score}/{ov.total}{p.adjustment ? <span className="tag tag-adj">معدّلة</span> : null}</td>
                  <td dir="ltr">{dur(p.activeMs)}</td>
                  <td>{p.wrongAttempts}</td>
                  <td>{t(p.startedAt)}</td>
                  <td>{t(p.finishedAt)}</td>
                  <td dir="ltr" className="mono">{p.recoveryCode}</td>
                  <td className="nowrap" onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-sm btn-ghost" onClick={() => { setErr(''); setNewScore(p.score); setModal({ kind: 'adjust', p }); }}>تصحيح</button>
                    <button className="btn btn-sm btn-danger" onClick={() => { setErr(''); setModal({ kind: 'delete', p }); }}>حذف</button>
                  </td>
                </tr>
                {open === p.id ? (
                  <tr className="a-detail">
                    <td colSpan={10}>
                      <div className="a-qgrid">
                        {ov.questions.map((q, i) => {
                          const d = p.perQuestion[i];
                          return (
                            <div className="a-q" key={q.id}>
                              <div className="a-q-h">السؤال {q.index} • الغرفة {q.room}</div>
                              <div className="a-q-t">{q.text}</div>
                              <div>المحاولات: <b>{d.attempts}</b> {d.wrong.length ? <span className="muted">(خطأ: {d.wrong.join('، ')})</span> : null}</div>
                              <div>{d.solvedAt ? <>✓ حُلّ في {t(d.solvedAt)}</> : <span className="muted">لم يُحل بعد</span>}</div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="muted small">وقت التسجيل: {t(p.createdAt)}</div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </section>

      <section className="glass a-log">
        <h2 className="h3">سجل العمليات</h2>
        {ov.log.length === 0 ? <p className="muted">لا توجد عمليات.</p> : null}
        <ul>
          {ov.log.map((l) => (
            <li key={l.id}>
              <span className="mono muted">{t(l.created_at)}</span>
              <b>{ACTION[l.action] || l.action}</b>
              {l.participant_name ? <span>— {l.participant_name}</span> : null}
              {l.details ? <span>— {l.details}</span> : null}
              {l.reason ? <span className="muted">— السبب: {l.reason}</span> : null}
            </li>
          ))}
        </ul>
      </section>

      {modal ? (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="panel glass modal a-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="h2">
              {modal.kind === 'delete' ? `حذف مشاركة: ${modal.p?.name}` : modal.kind === 'adjust' ? `تصحيح درجة: ${modal.p?.name}` : 'بدء جولة جديدة'}
            </h2>
            {modal.kind === 'adjust' ? (
              <label className="field">الدرجة الجديدة (من {ov.total})
                <select className="input" value={newScore} onChange={(e) => setNewScore(Number(e.target.value))}>
                  {Array.from({ length: ov.total + 1 }, (_, i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </label>
            ) : null}
            {modal.kind === 'reset' ? (
              <>
                <p className="muted">سيتم حذف جميع المشاركات ونتائجها وإلغاء الإعلان. صدّري CSV أولًا إن احتجتِ النتائج.</p>
                <label className="field">اكتبي «حذف الكل» للتأكيد
                  <input className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
                </label>
              </>
            ) : null}
            <label className="field">السبب (إلزامي)
              <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: تسجيل مكرر" />
            </label>
            {err ? <p className="err">{err}</p> : null}
            <div className="menu-row">
              <button className={`btn btn-lg ${modal.kind === 'adjust' ? 'btn-primary' : 'btn-danger'}`} disabled={busy || reason.trim().length < 3} onClick={runModal}>تأكيد</button>
              <button className="btn btn-ghost btn-lg" onClick={() => setModal(null)}>إلغاء</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Toggle({ label, on, onChange, hint, disabled }: { label: string; on: boolean; onChange: (v: boolean) => void; hint: string; disabled?: boolean }) {
  return (
    <div className="a-toggle">
      <button className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} disabled={disabled} role="switch" aria-checked={on} aria-label={label}><i /></button>
      <div><b>{label}: {on ? 'مفتوح' : 'مغلق'}</b><small>{hint}</small></div>
    </div>
  );
}
