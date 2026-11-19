'use client';
import { useEffect, useState } from 'react';
import { Confetti, Trophy, fmtTime } from './Visuals';
import { sound } from './sound';

export type Row = { rank: number; name: string; score: number; total: number; finished: boolean; activeMs: number };

export function Ceremony({ rows, onClose, highlight }: { rows: Row[]; onClose?: () => void; highlight?: string }) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const s = sound();
    s.stopSfx(); s.music(null);
    s.sfx('drumroll');
    const t = [
      setTimeout(() => { setStage(1); s.sfx('reveal'); }, 2200),
      setTimeout(() => { setStage(2); s.sfx('reveal'); }, 3700),
      setTimeout(() => { setStage(3); s.sfx('fanfare'); }, 5300),
      setTimeout(() => { setStage(4); s.music('ceremony'); }, 6800),
    ];
    return () => t.forEach(clearTimeout);
  }, []);
  const top = rows.slice(0, 3);
  const slot = (r: Row | undefined, place: 1 | 2 | 3) => {
    const visible = (place === 3 && stage >= 1) || (place === 2 && stage >= 2) || (place === 1 && stage >= 3);
    const tier = place === 1 ? 'gold' : place === 2 ? 'silver' : 'bronze';
    return (
      <div className={`podium-col place-${place} ${visible ? 'is-in' : ''}`} key={place}>
        <div className="podium-winner">
          {r ? (
            <>
              <Trophy tier={tier} />
              <div className={`podium-name ${highlight && r.name === highlight ? 'is-me' : ''}`}>{r.name}</div>
              <div className="podium-meta">{r.score}/{r.total} • {fmtTime(r.activeMs)}{!r.finished ? ' • لم تكتمل' : ''}</div>
            </>
          ) : <div className="podium-empty">—</div>}
        </div>
        <div className="podium-block"><span>{place}</span></div>
      </div>
    );
  };
  return (
    <div className="ceremony">
      <Confetti active={stage >= 3} />
      <div className="cer-head">
        <div className="eyebrow">MISSION RESULTS</div>
        <h1 className="cer-title">{stage === 0 ? 'والفائزات بالمراكز الأولى هن…' : 'أبطال مختبر البرمجة'}</h1>
      </div>
      <div className="podium">
        {slot(top[1], 2)}
        {slot(top[0], 1)}
        {slot(top[2], 3)}
      </div>
      {stage >= 4 && rows.length > 3 ? (
        <div className="cer-list glass">
          {rows.slice(3).map((r) => (
            <div className={`cer-row ${highlight && r.name === highlight ? 'is-me' : ''}`} key={r.rank}>
              <span className="cer-rank">{r.rank}</span>
              <span className="cer-name">{r.name}</span>
              {!r.finished ? <span className="tag tag-warn">لم تكتمل</span> : null}
              <span className="cer-score">{r.score}/{r.total}</span>
              <span className="cer-time">{fmtTime(r.activeMs)}</span>
            </div>
          ))}
        </div>
      ) : null}
      {onClose && stage >= 4 ? <button className="btn btn-ghost cer-close" onClick={onClose}>إغلاق</button> : null}
    </div>
  );
}
