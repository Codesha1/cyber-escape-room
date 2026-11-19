'use client';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Backdrop, CodeScript, Confetti, CoreLock, Gate, Guide, Padlock, Robot, Sparks, fmtTime, type Mood } from './Visuals';
import { Ceremony, type Row } from './Ceremony';
import { sound } from './sound';

type Opt = { id: string; label: string; text: string };
type Q = { id: string; room: 1 | 2; index: number; text: string; options: Opt[] };
type Me = { name: string; recoveryCode: string; started: boolean; finished: boolean; step: number; correct: number; total: number; roomsDone: number; progress: number; activeMs: number };
type State = { settings: { registrationOpen: boolean; playOpen: boolean; resultsAnnounced: boolean }; me: Me | null; question: Q | null };
type Phase = 'loading' | 'splash' | 'register' | 'code' | 'story' | 'room1' | 'progress50' | 'room2' | 'win';

async function api(path: string, body?: unknown) {
  try {
    const r = await fetch(path, {
      method: body !== undefined ? 'POST' : 'GET',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    const data = await r.json().catch(() => ({ error: 'استجابة غير متوقعة من الخادم.' }));
    return { ok: r.ok, status: r.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'تعذر الاتصال بالخادم. تحققي من الإنترنت.' } };
  }
}

function useSound() {
  const s = sound();
  const snap = useSyncExternalStore(
    (cb) => s.subscribe(cb),
    () => `${s.volume}|${s.muted}`,
    () => '0.7|false',
  );
  const [v, m] = snap.split('|');
  return { volume: Number(v), muted: m === 'true', s };
}

const ROOM1_INTRO = 'لفتح البوابة الأولى، عليكِ حل سؤالين حول لبنات التكرار في سكراتش.';
const ROOM2_INTRO = 'وصلتِ إلى التحدي الأخير! أثبتي مهارتك في استخدام التكرارات لفتح القفل النهائي.';
const WELCOME = 'مرحبًا أيتها المبرمجات! نحتاج إلى مساعدتكن لإنقاذ المختبر. أمامكن غرفتان مليئتان بالتحديات، عليكن حل الأسئلة وفتح الأقفال حتى يعود النظام للعمل من جديد. هل أنتن مستعدات؟';

export default function Game() {
  const [st, setSt] = useState<State | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState('');
  // التدريب (بعد الإكمال فقط — لا يغير النتيجة المسجلة)
  const [practice, setPractice] = useState(false);
  const [pq, setPq] = useState<Q[]>([]);
  const [pStep, setPStep] = useState(0);
  // مشهد الغرفة
  const [displayQ, setDisplayQ] = useState<Q | null>(null);
  const [qSwap, setQSwap] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [shake, setShake] = useState<{ id: string; n: number } | null>(null);
  const [right, setRight] = useState<string | null>(null);
  const [fb, setFb] = useState<{ kind: 'ok' | 'bad'; text: string; n: number } | null>(null);
  const [say, setSay] = useState('');
  const [mood, setMood] = useState<Mood>('idle');
  const [locksLit, setLocksLit] = useState(0);
  const [gateOpen, setGateOpen] = useState(false);
  const [roomLit, setRoomLit] = useState(false);
  const [sparks, setSparks] = useState(false);
  const [core, setCore] = useState(0);
  const [warp, setWarp] = useState(false);
  const [storyStage, setStoryStage] = useState(0);
  const [paused, setPaused] = useState<null | 'start' | 'play'>(null);
  const [menu, setMenu] = useState(false);
  const [ceremony, setCeremony] = useState<Row[] | null>(null);
  const [roomTimer, setRoomTimer] = useState(0);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = useCallback((fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); }, []);
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const announcedRef = useRef<boolean | null>(null);
  const phaseRef = useRef(phase); phaseRef.current = phase;

  const { volume, muted, s } = useSound();
  const me = st?.me ?? null;
  const step = practice ? pStep : me?.step ?? 0;
  const progress = step >= 3 ? 100 : step >= 2 ? 50 : 0;
  const roomsDone = step >= 3 ? 2 : step >= 2 ? 1 : 0;

  // ---------- تحميل الحالة ----------
  useEffect(() => {
    api('/api/state').then((r) => {
      if (r.ok) { setSt(r.data); announcedRef.current = r.data.settings.resultsAnnounced; }
      else setError(r.data.error || 'تعذر تحميل اللعبة.');
      setPhase('splash');
    });
    return () => clearTimers();
  }, []);

  // ---------- الانتقال بين المشاهد ----------
  const go = useCallback((p: Phase) => {
    clearTimers();
    s.stopSfx();
    setFb(null); setShake(null); setRight(null); setPending(null); setLocked(false); setSparks(false); setWarp(false);
    setPhase(p);
  }, [s]);

  const musicFor = (p: Phase) => (p === 'room1' || p === 'progress50' ? 'lab' : p === 'room2' ? 'final' : p === 'win' ? 'victory' : 'mystery');

  const enterRoom = useCallback((room: 1 | 2, q: Q | null, stepNow: number) => {
    go(room === 1 ? 'room1' : 'room2');
    s.music(room === 1 ? 'lab' : 'final');
    s.sfx('gate');
    setDisplayQ(q); setQSwap(false);
    setLocksLit(room === 1 ? Math.min(stepNow, 2) : 0);
    setGateOpen(false); setRoomLit(false); setCore(0);
    setMood('talk'); setSay(room === 1 ? (stepNow === 1 ? 'أحسنتِ في التحدي الأول! بقي سؤال واحد لفتح البوابة.' : ROOM1_INTRO) : ROOM2_INTRO);
    later(() => { s.sfx('question'); setMood('idle'); }, 1100);
  }, [go, later, s]);

  const routeFromState = useCallback((state: State) => {
    const m = state.me;
    if (!m) { go('register'); return; }
    if (m.finished) { go('win'); s.music('victory'); return; }
    if (!m.started) { go('story'); return; }
    if (m.step >= 2) { go('progress50'); s.music('lab'); return; }
    enterRoom(1, state.question, m.step);
  }, [enterRoom, go, s]);

  // ---------- نبض زمن اللعب ----------
  const inPlay = !practice && !!me?.started && !me?.finished && (phase === 'room1' || phase === 'room2' || phase === 'progress50');
  useEffect(() => {
    if (!inPlay) return;
    const beat = async () => {
      const r = await api('/api/heartbeat', { visible: !document.hidden });
      if (r.ok && r.data.playOpen === false) setPaused('play');
    };
    beat();
    const id = setInterval(beat, 5000);
    const hide = () => { try { navigator.sendBeacon('/api/heartbeat', JSON.stringify({ visible: false })); } catch {} };
    const vis = () => { if (document.hidden) hide(); else beat(); };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('pagehide', hide);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', vis); window.removeEventListener('pagehide', hide); };
  }, [inPlay]);

  // مؤقت زخرفي في الغرفة الثانية
  useEffect(() => {
    if (phase !== 'room2') return;
    const base = Date.now();
    const id = setInterval(() => setRoomTimer(Date.now() - base), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // ---------- متابعة الإعلان والإيقاف المؤقت ----------
  useEffect(() => {
    if (phase === 'loading' || phase === 'splash') return;
    const id = setInterval(async () => {
      const r = await api('/api/state');
      if (!r.ok) return;
      const ns: State = r.data;
      setSt((old) => (old ? { ...old, settings: ns.settings } : ns));
      if (announcedRef.current === false && ns.settings.resultsAnnounced) {
        const lb = await api('/api/leaderboard');
        if (lb.ok && lb.data.announced) setCeremony(lb.data.rows);
      }
      announcedRef.current = ns.settings.resultsAnnounced;
    }, 6000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (!paused) return;
    const id = setInterval(async () => {
      const r = await api('/api/state');
      if (r.ok && r.data.settings.playOpen) {
        setPaused(null);
        if (paused === 'play' && r.data.me?.started) api('/api/start', {});
      }
    }, 3000);
    return () => clearInterval(id);
  }, [paused]);

  // ---------- القصة ----------
  useEffect(() => {
    if (phase !== 'story') return;
    setStoryStage(0); setSay(''); setMood('idle');
    const t = [
      setTimeout(() => { setStoryStage(1); s.sfx('glitch'); }, 2800),
      setTimeout(() => { setStoryStage(2); s.sfx('alarm'); }, 3600),
      setTimeout(() => { setStoryStage(3); setMood('talk'); setSay(WELCOME); }, 7600),
      setTimeout(() => setStoryStage(4), 9200),
    ];
    return () => t.forEach(clearTimeout);
  }, [phase, s]);
  const skipStory = () => { s.sfx('click'); setStoryStage(4); setMood('talk'); setSay(WELCOME); };

  // ---------- الأفعال ----------
  const onSplash = () => {
    s.unlock(); s.sfx('boot'); s.music('mystery');
    if (!st) { location.reload(); return; }
    setTimeout(() => routeFromState(st), 350);
  };

  const [nameIn, setNameIn] = useState('');
  const [codeIn, setCodeIn] = useState('');
  const [restoreMode, setRestoreMode] = useState(false);
  const [busy, setBusy] = useState(false);

  const register = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return;
    s.sfx('click'); setBusy(true); setError('');
    const r = await api('/api/register', { name: nameIn });
    setBusy(false);
    if (!r.ok) { setError(r.data.error); s.sfx('wrong'); return; }
    setSt(r.data); s.sfx('success'); go('code');
  };
  const restore = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return;
    s.sfx('click'); setBusy(true); setError('');
    const r = await api('/api/restore', { code: codeIn });
    setBusy(false);
    if (!r.ok) { setError(r.data.error); s.sfx('wrong'); return; }
    setSt(r.data); s.sfx('success'); setRestoreMode(false); routeFromState(r.data);
  };

  const startMission = async () => {
    if (busy) return;
    s.sfx('click');
    if (practice) { s.sfx('boot'); setWarp(true); setTimeout(() => enterRoom(1, pq[0], 0), 900); return; }
    setBusy(true);
    const r = await api('/api/start', {});
    setBusy(false);
    if (r.status === 423) { setPaused('start'); return; }
    if (r.status === 401) { setSt((o) => (o ? { ...o, me: null } : o)); go('register'); return; }
    if (!r.ok) { setError(r.data.error); return; }
    setSt(r.data); s.sfx('boot'); setWarp(true);
    setTimeout(() => routeFromState(r.data), 900);
  };

  const toRoom2 = () => {
    s.sfx('click'); s.stopSfx(); s.sfx('gate'); s.sfx('transition'); setWarp(true);
    const q = practice ? pq[2] : st?.question ?? null;
    later(() => enterRoom(2, q, 2), 1300);
  };

  const choose = async (opt: Opt) => {
    if (!displayQ || pending || locked) return;
    s.sfx('click');
    setPending(opt.id); setFb(null);
    let correct = false; let message = ''; let nextQ: Q | null = null; let newStep = step;
    if (practice) {
      const r = await api('/api/practice', { questionId: displayQ.id, choice: opt.id });
      if (!r.ok) { setPending(null); setError(r.data.error); return; }
      correct = r.data.correct; message = r.data.message;
      if (correct) { newStep = pStep + 1; setPStep(newStep); nextQ = pq[newStep] ?? null; }
    } else {
      const r = await api('/api/answer', { questionId: displayQ.id, choice: opt.id });
      if (r.status === 423) { setPending(null); setPaused('play'); return; }
      if (r.status === 401) { setPending(null); setSt((o) => (o ? { ...o, me: null } : o)); go('register'); return; }
      if (!r.ok) { setPending(null); setError(r.data.error); return; }
      setSt(r.data);
      if (r.data.stale) { setPending(null); routeFromState(r.data); return; }
      correct = r.data.correct; message = r.data.message; nextQ = r.data.question; newStep = r.data.me.step;
    }
    setPending(null);

    if (!correct) {
      s.sfx('wrong');
      setShake({ id: opt.id, n: Date.now() });
      setFb({ kind: 'bad', text: 'الإجابة غير صحيحة — حاولي مرة أخرى', n: Date.now() });
      setMood('hint'); setSay(message);
      return;
    }

    // إجابة صحيحة
    setLocked(true); setRight(opt.id);
    s.sfx('success');
    setMood('happy'); setSay(message);

    if (phase === 'room1' && newStep === 1) {
      setLocksLit(1);
      setFb({ kind: 'ok', text: 'تم فتح القفل الأول', n: Date.now() });
      later(() => setQSwap(true), 2400);
      later(() => {
        setDisplayQ(nextQ); setQSwap(false); setRight(null); setLocked(false); setFb(null);
        s.sfx('question'); setMood('talk'); setSay('رائع! والآن التحدي الثاني.');
      }, 2800);
    } else if (phase === 'room1' && newStep === 2) {
      setLocksLit(2);
      setFb({ kind: 'ok', text: 'تم فتح القفل الثاني', n: Date.now() });
      later(() => { setGateOpen(true); setRoomLit(true); setSparks(true); s.sfx('gate'); }, 900);
      later(() => { go('progress50'); }, 4600);
    } else if (phase === 'room2') {
      setFb({ kind: 'ok', text: 'جارٍ فتح القفل النهائي…', n: Date.now() });
      setSay('');
      later(() => { setCore(1); }, 300);
      later(() => { setCore(2); s.sfx('unlock'); }, 1000);
      later(() => { setCore(3); }, 2300);
      later(() => { setGateOpen(true); setRoomLit(true); s.sfx('gate'); }, 2700);
      later(() => { s.sfx('fanfare'); setSparks(true); setMood('party'); setSay(message); setFb({ kind: 'ok', text: 'تم فتح القفل النهائي', n: Date.now() }); }, 3500);
      later(() => { go('win'); s.music('victory'); }, 6400);
    }
  };

  const startPractice = async () => {
    s.sfx('click');
    const r = await api('/api/practice');
    if (!r.ok) { setError(r.data.error); return; }
    setPq(r.data.questions); setPStep(0); setPractice(true); setMenu(false);
    go('story'); s.music('mystery');
  };
  const exitPractice = () => { setPractice(false); setMenu(false); go('win'); s.music('victory'); };
  const newPlayer = async () => {
    s.sfx('click');
    await api('/api/logout', {});
    setPractice(false); setMenu(false); setNameIn(''); setCodeIn('');
    const r = await api('/api/state');
    if (r.ok) setSt(r.data);
    go('register'); s.music('mystery');
  };
  const backToStart = () => { s.sfx('click'); setMenu(false); go('splash'); s.music(null); };

  const showHud = phase === 'room1' || phase === 'room2' || phase === 'progress50' || phase === 'win';

  return (
    <main className={`stage phase-${phase} ${roomLit ? 'room-lit' : ''}`}>
      <Backdrop
        theme={phase === 'room2' ? 'room2' : phase === 'room1' || phase === 'progress50' ? 'room1' : phase === 'win' ? 'win' : phase === 'story' ? 'story' : 'lab'}
        lit={roomLit || phase === 'win'}
        alarm={phase === 'story' && storyStage >= 1 && storyStage < 3}
      />

      {showHud ? (
        <header className="hud">
          <div className="hud-brand">
            <div className="hud-logo">CYBER <span>ESCAPE</span> ROOM</div>
            <div className="hud-mission">مهمة: إنقاذ مختبر البرمجة{practice ? <em className="tag">وضع التدريب</em> : null}</div>
          </div>
          <div className="hud-progress" aria-label={`نسبة الإنجاز ${progress}%`}>
            <div className="hp-top"><span>MISSION PROGRESS</span><b>{progress}%</b></div>
            <div className="hp-bar"><i style={{ width: `${progress}%` }} /><span className="hp-mark" /></div>
            <div className="hp-rooms">
              {[1, 2].map((n) => (
                <span key={n} className={`room-chip ${roomsDone >= n ? 'done' : (phase === 'room2' ? 2 : 1) === n && phase !== 'win' ? 'active' : ''}`}>
                  {roomsDone >= n ? '✓' : n === 2 && roomsDone < 1 ? '🔒' : '●'} الغرفة {n === 1 ? '01' : '02'}
                </span>
              ))}
            </div>
          </div>
          <div className="hud-tools">
            <div className="score-pill" aria-label={`الإجابات الصحيحة ${step} من 3`}>
              <span className="sp-ico">✓</span><b>{Math.min(step, 3)}</b><span>/3</span>
            </div>
            <button className={`icon-btn ${muted ? 'is-off' : ''}`} onClick={() => { s.unlock(); s.toggleMute(); }} aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'} title={muted ? 'تشغيل الصوت' : 'كتم الصوت'}>
              {muted ? <SpeakerOff /> : <SpeakerOn />}
            </button>
            <input className="vol" type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} onChange={(e) => { s.unlock(); s.setVolume(Number(e.target.value)); }} aria-label="مستوى الصوت" />
            <button className="icon-btn" onClick={() => { s.sfx('click'); setMenu(true); }} aria-label="إعادة تشغيل اللعبة" title="إعادة تشغيل اللعبة"><Restart /></button>
          </div>
        </header>
      ) : null}

      {/* ===================== شاشة البداية ===================== */}
      {phase === 'loading' ? <div className="center-msg"><div className="loader" /></div> : null}
      {phase === 'splash' ? (
        <section className="scene splash">
          <div className="splash-ring" aria-hidden><i /><i /><i /></div>
          <div className="eyebrow">مهمة تعليمية تفاعلية • التكرارات في سكراتش</div>
          <h1 className="title-xl glitch" data-text="CYBER ESCAPE ROOM">CYBER ESCAPE ROOM</h1>
          <p className="subtitle">مهمة إنقاذ مختبر البرمجة</p>
          {error ? <p className="err">{error}</p> : null}
          <button className="btn btn-primary btn-xl pulse" onClick={onSplash}>
            <span>دخول المختبر</span>
          </button>
          <p className="hint-small">🔊 يُفضّل تشغيل الصوت</p>
        </section>
      ) : null}

      {/* ===================== التسجيل ===================== */}
      {phase === 'register' ? (
        <section className="scene register">
          <Guide size="md" mood="talk" say={restoreMode ? 'اكتبي رمز الاستعادة لتكملي من حيث توقفتِ.' : 'اكتبي اسمكِ لنسجّلكِ في فريق إنقاذ المختبر!'} />
          <div className="panel glass reg-card">
            <div className="eyebrow">ACCESS TERMINAL</div>
            {!st?.settings.registrationOpen && !restoreMode ? (
              <>
                <h2 className="h2">التسجيل مغلق حاليًا</h2>
                <p className="muted">انتظري إشارة المعلمة لفتح التسجيل.</p>
              </>
            ) : restoreMode ? (
              <form onSubmit={restore} className="form">
                <h2 className="h2">استعادة التقدم</h2>
                <input className="input input-code" dir="ltr" value={codeIn} onChange={(e) => setCodeIn(e.target.value.toUpperCase())} placeholder="ABC-123" maxLength={8} autoFocus aria-label="رمز الاستعادة" />
                <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'جارٍ التحقق…' : 'استعادة'}</button>
              </form>
            ) : (
              <form onSubmit={register} className="form">
                <h2 className="h2">تسجيل المبرمجة</h2>
                <input className="input" value={nameIn} onChange={(e) => setNameIn(e.target.value)} placeholder="اكتبي اسمك هنا" maxLength={30} autoFocus aria-label="الاسم" />
                <button className="btn btn-primary btn-lg" disabled={busy || nameIn.trim().length < 2}>{busy ? 'جارٍ التسجيل…' : 'انضمي إلى المهمة'}</button>
              </form>
            )}
            {error ? <p className="err" role="alert">{error}</p> : null}
            <button className="link" onClick={() => { setError(''); setRestoreMode(!restoreMode); }}>
              {restoreMode ? 'تسجيل اسم جديد' : 'لديّ رمز استعادة'}
            </button>
          </div>
        </section>
      ) : null}

      {phase === 'code' && me ? (
        <section className="scene register">
          <Guide size="md" mood="happy" say={`أهلًا ${me.name}! احتفظي برمز الاستعادة.`} />
          <div className="panel glass reg-card">
            <div className="eyebrow">ACCESS GRANTED</div>
            <h2 className="h2">رمز الاستعادة الخاص بك</h2>
            <div className="code-box" dir="ltr">{me.recoveryCode}</div>
            <p className="muted">إذا انقطع الاتصال أو انتقلتِ إلى جهاز آخر، استخدمي هذا الرمز لتكملي من حيث توقفتِ.</p>
            <button className="btn btn-primary btn-lg" onClick={() => { s.sfx('click'); go('story'); }}>متابعة</button>
          </div>
        </section>
      ) : null}

      {/* ===================== القصة ===================== */}
      {phase === 'story' ? (
        <section className={`scene story stage-${storyStage}`}>
          <div className="story-lab" aria-hidden>
            <div className="monitors">
              {Array.from({ length: 5 }, (_, i) => (
                <div className="monitor" key={i}><div className="mon-lines"><i /><i /><i /><i /></div></div>
              ))}
            </div>
            <div className="robots">
              <Robot state={storyStage >= 1 ? 'off' : 'work'} hue="cyan" />
              <Robot state={storyStage >= 1 ? 'off' : 'work'} hue="violet" delay={0.4} />
              <Robot state={storyStage >= 1 ? 'off' : 'work'} hue="pink" delay={0.8} />
            </div>
          </div>
          {storyStage === 0 ? <p className="caption">في عالم رقمي مستقبلي… يوجد مختبر برمجة متطور تتعلم فيه الروبوتات تنفيذ الأوامر البرمجية.</p> : null}
          {storyStage >= 1 && storyStage < 3 ? (
            <div className="failure">
              <div className="fail-title glitch" data-text="SYSTEM FAILURE!">SYSTEM FAILURE!</div>
              {storyStage >= 2 ? <p className="fail-text">تم إغلاق مختبر البرمجة، ولا يمكن إعادة تشغيله إلا بعد اجتياز اختبارين برمجيين واستعادة مفاتيح النظام.</p> : null}
            </div>
          ) : null}
          {storyStage >= 3 ? (
            <div className="story-guide">
              <Guide size="lg" mood={mood} say={say} side="center" />
              <button className={`btn btn-primary btn-xl ${storyStage >= 4 ? 'is-in' : 'is-hidden'}`} onClick={startMission} disabled={busy || storyStage < 4}>
                {busy ? 'جارٍ التشغيل…' : practice ? 'ابدئي التدريب' : 'ابدئي المهمة'}
              </button>
            </div>
          ) : (
            <button className="btn btn-ghost skip" onClick={skipStory}>تخطي المقدمة</button>
          )}
          {error ? <p className="err floating">{error}</p> : null}
        </section>
      ) : null}

      {/* ===================== الغرفة الأولى ===================== */}
      {phase === 'room1' ? (
        <section className="scene room room1">
          <div className="room-title"><span className="rt-code">ROOM 01</span><span className="rt-name">CODE CHAMBER</span><span className="rt-ar">غرفة الأوامر البرمجية</span></div>
          <div className="room-grid">
            <aside className="room-side">
              <Guide size="md" mood={mood} say={say} />
            </aside>
            <div className="room-main">
              <div className="holo glass">
                <div className="holo-head">
                  <span className="dot" /><span className="dot" /><span className="dot" />
                  <span className="holo-tag">التحدي {displayQ?.index === 2 ? 'الثاني' : 'الأول'} • {displayQ?.index ?? 1}/3</span>
                </div>
                <div className={`qwrap ${qSwap ? 'swap-out' : 'swap-in'}`} key={displayQ?.id}>
                  <h2 className="question">{displayQ?.text}</h2>
                  <Options q={displayQ} pending={pending} right={right} shake={shake} locked={locked} onChoose={choose} />
                </div>
                {fb ? <div className={`feedback fb-${fb.kind}`} key={fb.n}>{fb.kind === 'ok' ? '✓' : '✕'} {fb.text}</div> : null}
              </div>
            </div>
            <aside className="room-device">
              <div className="device-screen glass"><div className="ds-label">SCRATCH // LOOP.SYS</div><CodeScript variant="room1" solved={locksLit >= 2} /></div>
              <div className="locks">
                <Padlock open={locksLit >= 1} label="القفل 1" />
                <Padlock open={locksLit >= 2} label="القفل 2" />
              </div>
              <div className="energy">{[0, 1, 2, 3, 4, 5].map((i) => <i key={i} className={i < (locksLit * 3) ? 'on' : ''} />)}<span>ENERGY</span></div>
              <Gate open={gateOpen}><Sparks active={sparks} color="green" /></Gate>
            </aside>
          </div>
        </section>
      ) : null}

      {/* ===================== شاشة 50٪ ===================== */}
      {phase === 'progress50' ? (
        <section className="scene mid">
          <Confetti active density={0.4} />
          <div className="eyebrow">MISSION PROGRESS – 50%</div>
          <div className="mid-row">
            <div className="mid-room done"><div className="mr-ico">✓</div><div>الغرفة الأولى</div><small>CODE CHAMBER</small></div>
            <div className="mid-ring">
              <svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="84" className="mr-track" /><circle cx="100" cy="100" r="84" className="mr-fill" /></svg>
              <b>50%</b>
            </div>
            <div className="mid-room locked"><Gate open={false} variant="room2" /><div>الغرفة الثانية</div><small>LOOP MASTER</small></div>
          </div>
          <h1 className="title-lg">تم إنجاز نصف المهمة!</h1>
          <p className="lead">رائع! نجحتن في فتح الغرفة الأولى، بقيت خطوة واحدة لإكمال المهمة وإنقاذ مختبر البرمجة.</p>
          <button className="btn btn-primary btn-xl" onClick={toRoom2}>الانتقال إلى الغرفة الثانية</button>
        </section>
      ) : null}

      {/* ===================== الغرفة الثانية ===================== */}
      {phase === 'room2' ? (
        <section className="scene room room2">
          <div className="room-title"><span className="rt-code">ROOM 02</span><span className="rt-name">LOOP MASTER</span><span className="rt-ar">غرفة التحدي النهائي</span></div>
          <div className="room-grid">
            <aside className="room-side">
              <Guide size="md" mood={mood} say={say} />
            </aside>
            <div className="room-main">
              <div className="holo holo-xl glass">
                <div className="holo-head">
                  <span className="dot" /><span className="dot" /><span className="dot" />
                  <span className="holo-tag">التحدي النهائي • 3/3</span>
                  <span className="deco-timer" dir="ltr">T+{fmtTime(roomTimer)}</span>
                </div>
                <div className="qwrap swap-in" key={displayQ?.id}>
                  <h2 className="question">{displayQ?.text}</h2>
                  <Options q={displayQ} pending={pending} right={right} shake={shake} locked={locked} onChoose={choose} />
                </div>
                {fb ? <div className={`feedback fb-${fb.kind}`} key={fb.n}>{fb.kind === 'ok' ? '✓' : '✕'} {fb.text}</div> : null}
              </div>
            </div>
            <aside className="room-device">
              <div className="device-screen glass"><div className="ds-label">MAIN.SYSTEM // MISSING BLOCK</div><CodeScript variant="room2" solved={core >= 1} /></div>
              <div className="core-wrap"><CoreLock stage={core} /><Sparks active={sparks} color="pink" /></div>
              <div className="energy pink">{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <i key={i} className={core >= 1 || i < 5 ? 'on' : ''} />)}<span>POWER</span></div>
              <Gate open={gateOpen} variant="room2" />
            </aside>
          </div>
        </section>
      ) : null}

      {/* ===================== الفوز ===================== */}
      {phase === 'win' ? (
        <section className="scene win">
          <Confetti active />
          <div className="win-monitors" aria-hidden>
            {Array.from({ length: 5 }, (_, i) => <div className="monitor" key={i}><div className="mon-lines"><i /><i /><i /><i /></div></div>)}
          </div>
          <div className="win-robots" aria-hidden>
            <Robot state="dance" hue="cyan" /><Robot state="dance" hue="violet" delay={0.3} />
            <div className="win-spacer" />
            <Robot state="dance" hue="pink" delay={0.15} /><Robot state="dance" hue="cyan" delay={0.45} />
          </div>
          <div className="win-grid">
            <div className="win-hero">
              <Guide size="lg" mood="party" side="center" />
            </div>
            <div className="win-info">
              <div className="eyebrow">MISSION COMPLETED – 100%</div>
              <h1 className="title-lg win-title">تهانينا! تمت المهمة بنجاح</h1>
              <p className="lead">أنتن الآن خبيرات التكرار في سكراتش!</p>
              <div className="badge glass">
                <div className="badge-head">
                  <span className="badge-ico">★</span>
                  <div><div className="badge-name">{me?.name}</div><div className="muted small">بطاقة إنجاز {practice ? '• جولة تدريب' : ''}</div></div>
                </div>
                <div className="badge-stats">
                  <div><span>نسبة إكمال المهمة</span><b>100%</b></div>
                  <div><span>الغرف المكتملة</span><b>2 من 2</b></div>
                  <div><span>الإجابات الصحيحة</span><b>3 من 3</b></div>
                  {!practice && me ? <div><span>زمن اللعب</span><b dir="ltr">{fmtTime(me.activeMs)}</b></div> : null}
                  <div className="wide"><span>الحالة</span><b className="ok">تم إنقاذ مختبر البرمجة بنجاح</b></div>
                </div>
              </div>
              <div className="win-actions">
                <button className="btn btn-primary btn-lg" onClick={startPractice}>إعادة اللعب</button>
                {st?.settings.resultsAnnounced ? (
                  <button className="btn btn-ghost btn-lg" onClick={async () => { const lb = await api('/api/leaderboard'); if (lb.ok && lb.data.announced) setCeremony(lb.data.rows); }}>عرض النتائج</button>
                ) : null}
                <button className="btn btn-ghost btn-lg" onClick={newPlayer}>لاعبة جديدة</button>
              </div>
              {!practice ? <p className="muted small">نتيجتك محفوظة. «إعادة اللعب» جولة تدريب لا تغيّر النتيجة.</p> : null}
            </div>
          </div>
        </section>
      ) : null}

      {warp ? <div className="warp" aria-hidden /> : null}

      {error && (phase === 'room1' || phase === 'room2' || phase === 'win') ? (
        <div className="toast" role="alert" onClick={() => setError('')}>{error}</div>
      ) : null}

      {paused ? (
        <div className="overlay">
          <div className="panel glass modal">
            <div className="eyebrow">SYSTEM STANDBY</div>
            <h2 className="h2">{paused === 'start' ? 'المهمة لم تُفتح بعد' : 'توقفت المهمة مؤقتًا'}</h2>
            <p className="muted">انتظري إشارة المعلمة… ستكملين تلقائيًا عند فتح المهمة. (الوقت متوقف الآن)</p>
            <div className="loader" />
          </div>
        </div>
      ) : null}

      {menu ? (
        <div className="overlay" onClick={() => setMenu(false)}>
          <div className="panel glass modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="h2">إعادة تشغيل اللعبة</h2>
            <div className="menu-list">
              {practice ? (
                <>
                  <button className="btn btn-primary btn-lg" onClick={startPractice}>إعادة التدريب من البداية</button>
                  <button className="btn btn-ghost btn-lg" onClick={exitPractice}>إنهاء التدريب</button>
                </>
              ) : me?.finished ? (
                <button className="btn btn-primary btn-lg" onClick={startPractice}>إعادة اللعب (تدريب — نتيجتك محفوظة)</button>
              ) : (
                <button className="btn btn-primary btn-lg" onClick={backToStart}>العودة إلى شاشة البداية (يُحفظ تقدمك)</button>
              )}
              <button className="btn btn-ghost btn-lg" onClick={newPlayer}>لاعبة جديدة على هذا الجهاز</button>
              <button className="link" onClick={() => setMenu(false)}>إلغاء</button>
            </div>
          </div>
        </div>
      ) : null}

      {ceremony ? (
        <div className="overlay overlay-solid">
          <Ceremony rows={ceremony} highlight={me?.name} onClose={() => { setCeremony(null); s.music(musicFor(phaseRef.current)); }} />
        </div>
      ) : null}
    </main>
  );
}

function Options({ q, pending, right, shake, locked, onChoose }: {
  q: Q | null; pending: string | null; right: string | null; shake: { id: string; n: number } | null; locked: boolean; onChoose: (o: Opt) => void;
}) {
  if (!q) return null;
  return (
    <div className="options">
      {q.options.map((o, i) => (
        <button
          key={o.id + (shake?.id === o.id ? shake.n : '')}
          className={`opt ${pending === o.id ? 'is-pending' : ''} ${right === o.id ? 'is-right' : ''} ${shake?.id === o.id ? 'is-wrong' : ''} ${locked && right !== o.id ? 'is-dim' : ''}`}
          style={{ animationDelay: `${0.08 * i}s` }}
          onClick={() => onChoose(o)}
          disabled={locked || !!pending}
        >
          <span className="opt-label">{o.label}</span>
          <span className="opt-text">{o.text}</span>
        </button>
      ))}
    </div>
  );
}

const SpeakerOn = () => (<svg viewBox="0 0 24 24" aria-hidden><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" /></svg>);
const SpeakerOff = () => (<svg viewBox="0 0 24 24" aria-hidden><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M17 9l5 6M22 9l-5 6" fill="none" /></svg>);
const Restart = () => (<svg viewBox="0 0 24 24" aria-hidden><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5" fill="none" /></svg>);
