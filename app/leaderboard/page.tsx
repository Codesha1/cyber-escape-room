'use client';
import { useEffect, useRef, useState } from 'react';
import { Backdrop } from '@/components/Visuals';
import { Ceremony, type Row } from '@/components/Ceremony';
import { sound } from '@/components/sound';

type LB = { announced: boolean; counts: { registered: number; playing: number; finished: number }; rows: Row[]; announcedAt?: string };

export default function Leaderboard() {
  const [lb, setLb] = useState<LB | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [runKey, setRunKey] = useState<string | null>(null);
  const prev = useRef<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch('/api/leaderboard', { cache: 'no-store' });
        if (!r.ok) return;
        const d: LB = await r.json();
        if (!alive) return;
        setLb(d);
        // يبدأ الحفل تلقائيًا عند الإعلان (أو عند فتح الصفحة بعد الإعلان)
        if (d.announced && prev.current !== true) setRunKey(d.announcedAt || String(Date.now()));
        if (!d.announced) setRunKey(null);
        prev.current = d.announced;
      } catch {}
    };
    load();
    const id = setInterval(load, 4000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const enableSound = () => {
    const s = sound(); s.unlock(); setSoundOn(true);
    if (!lb?.announced) s.music('mystery');
  };

  return (
    <main className="stage phase-leaderboard">
      <Backdrop theme={lb?.announced ? 'win' : 'room2'} lit={!!lb?.announced} />
      {!soundOn ? (
        <button className="btn btn-ghost sound-gate" onClick={enableSound}>🔊 تفعيل الصوت</button>
      ) : null}
      {lb?.announced && runKey ? (
        <Ceremony key={runKey + (soundOn ? '1' : '0')} rows={lb.rows} />
      ) : (
        <section className="scene lb-wait">
          <div className="eyebrow">LIVE MISSION STATUS</div>
          <h1 className="title-xl glitch" data-text="CYBER ESCAPE ROOM">CYBER ESCAPE ROOM</h1>
          <p className="subtitle">النتائج سرّية حتى إعلان المعلمة</p>
          <div className="lb-counts">
            <div className="lb-count glass"><b>{lb?.counts.registered ?? '—'}</b><span>مسجّلة</span></div>
            <div className="lb-count glass pink"><b>{lb?.counts.playing ?? '—'}</b><span>داخل المختبر الآن</span></div>
            <div className="lb-count glass green"><b>{lb?.counts.finished ?? '—'}</b><span>أنقذت المختبر</span></div>
          </div>
          <div className="loader" />
        </section>
      )}
    </main>
  );
}
