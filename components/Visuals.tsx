'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

/* ===================== الخلفية الحية ===================== */
const CODE_LINES = [
  'repeat(10) {', 'move(10);', 'turn(15);', '}', 'when flag clicked', 'forever {', 'if (touching) {',
  'say("Hello!");', 'wait(1);', 'loop.count++', 'SYS.REBOOT()', '0x1F4A', 'unlock(gate);', 'key[01] = true',
];

export function Backdrop({ theme, lit = false, alarm = false }: { theme: 'lab' | 'room1' | 'room2' | 'win' | 'story'; lit?: boolean; alarm?: boolean }) {
  const cols = useMemo(
    () => Array.from({ length: 9 }, (_, i) => ({
      left: 4 + i * 11.5 + (i % 2) * 3,
      delay: -(i * 2.3) % 14,
      dur: 14 + (i % 4) * 3,
      lines: Array.from({ length: 14 }, (_, j) => CODE_LINES[(i * 5 + j * 3) % CODE_LINES.length]),
    })),
    [],
  );
  const dots = useMemo(
    () => Array.from({ length: 34 }, (_, i) => ({
      left: (i * 37) % 100, top: (i * 53) % 100, size: 0.15 + ((i * 7) % 5) * 0.08, delay: -((i * 1.7) % 9), dur: 7 + (i % 5) * 2,
    })),
    [],
  );
  return (
    <div className={`backdrop theme-${theme} ${lit ? 'is-lit' : ''} ${alarm ? 'is-alarm' : ''}`} aria-hidden>
      <div className="bd-glow" />
      <div className="bd-floor"><div className="bd-floor-grid" /></div>
      <svg className="bd-circuit" viewBox="0 0 1600 900" preserveAspectRatio="none">
        {[
          'M0 140 H260 L320 200 H620', 'M1600 120 H1320 L1260 180 H980', 'M0 760 H200 L260 700 H520',
          'M1600 780 H1380 L1320 720 H1060', 'M120 0 V90 L180 150', 'M1480 0 V80 L1420 140', 'M800 0 V60',
        ].map((d, i) => (
          <g key={i}>
            <path d={d} className="trace" />
            <path d={d} className="trace-pulse" style={{ animationDelay: `${-i * 0.9}s` }} />
          </g>
        ))}
        {[[620, 200], [980, 180], [520, 700], [1060, 720], [180, 150], [1420, 140]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="5" className="node" />
        ))}
      </svg>
      <div className="bd-code">
        {cols.map((c, i) => (
          <div key={i} className="code-col" style={{ left: `${c.left}%`, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s` }}>
            {c.lines.map((l, j) => <span key={j}>{l}</span>)}
          </div>
        ))}
      </div>
      <div className="bd-dots">
        {dots.map((d, i) => (
          <i key={i} style={{ left: `${d.left}%`, top: `${d.top}%`, width: `calc(var(--u) * ${d.size})`, height: `calc(var(--u) * ${d.size})`, animationDelay: `${d.delay}s`, animationDuration: `${d.dur}s` }} />
        ))}
      </div>
      <div className="bd-vignette" />
      <div className="bd-scan" />
    </div>
  );
}

/* ===================== الشخصية المرشدة ===================== */
export type Mood = 'idle' | 'happy' | 'hint' | 'party' | 'talk';
export function Guide({ say, mood = 'idle', size = 'md', side = 'start' }: { say?: string; mood?: Mood; size?: 'sm' | 'md' | 'lg'; side?: 'start' | 'center' }) {
  const [shown, setShown] = useState('');
  useEffect(() => {
    if (!say) { setShown(''); return; }
    let i = 0;
    setShown('');
    const t = setInterval(() => {
      i += 2;
      setShown(say.slice(0, i));
      if (i >= say.length) clearInterval(t);
    }, 22);
    return () => clearInterval(t);
  }, [say]);
  return (
    <div className={`guide guide-${size} guide-${side} mood-${mood}`}>
      {say ? (
        <div className="bubble glass" key={say} role="status" aria-live="polite">
          <span className="bubble-text">{shown}<span className="sr-only">{say}</span></span>
        </div>
      ) : null}
      <div className="guide-body">
        <div className="guide-halo" />
        {/* الشخصية الأصلية من العرض التقديمي — تُعرض كما هي دون تعديل */}
        <img src="/guide.png" alt="الشخصية المرشدة" className="guide-img" draggable={false} />
        <div className="guide-base"><span /><span /><span /></div>
      </div>
    </div>
  );
}

/* ===================== روبوت المختبر (تصميم أصلي) ===================== */
export function Robot({ state = 'work', hue = 'cyan', delay = 0 }: { state?: 'work' | 'off' | 'dance'; hue?: 'cyan' | 'pink' | 'violet'; delay?: number }) {
  return (
    <svg className={`robot robot-${state} hue-${hue}`} viewBox="0 0 120 170" style={{ animationDelay: `${delay}s` }} aria-hidden>
      <line x1="60" y1="8" x2="60" y2="26" className="r-stroke" />
      <circle cx="60" cy="8" r="6" className="r-led" />
      <rect x="28" y="26" width="64" height="48" rx="14" className="r-head" />
      <rect x="38" y="38" width="44" height="22" rx="10" className="r-visor" />
      <circle cx="50" cy="49" r="5" className="r-eye" />
      <circle cx="70" cy="49" r="5" className="r-eye" />
      <rect x="54" y="74" width="12" height="8" className="r-neck" />
      <rect x="24" y="82" width="72" height="56" rx="16" className="r-body" />
      <rect x="44" y="96" width="32" height="18" rx="5" className="r-panel" />
      <g className="r-arm r-arm-l"><rect x="6" y="88" width="16" height="42" rx="8" className="r-limb" /></g>
      <g className="r-arm r-arm-r"><rect x="98" y="88" width="16" height="42" rx="8" className="r-limb" /></g>
      <rect x="36" y="138" width="18" height="26" rx="7" className="r-limb" />
      <rect x="66" y="138" width="18" height="26" rx="7" className="r-limb" />
    </svg>
  );
}

/* ===================== لبنات البرمجة (بأسلوب نيون) ===================== */
export function CodeScript({ variant, solved }: { variant: 'room1' | 'room2'; solved: boolean }) {
  if (variant === 'room1') {
    return (
      <div className={`script ${solved ? 'is-solved' : ''}`} aria-hidden>
        <div className="blk blk-hat">عند نقر العلم</div>
        <div className="blk blk-c">
          <div className="blk-c-top">كرّر <b className="slot">4</b></div>
          <div className="blk-c-inner">
            <div className="blk blk-move">تحرك <b className="slot">10</b> خطوات</div>
            <div className="blk blk-move">استدر <b className="slot">90</b> درجة</div>
          </div>
          <div className="blk-c-bottom" />
        </div>
      </div>
    );
  }
  return (
    <div className={`script script-3d ${solved ? 'is-solved' : ''}`} aria-hidden>
      <div className="blk blk-hat">عند نقر العلم</div>
      <div className={`blk-missing ${solved ? 'filled' : ''}`}>
        {solved ? (
          <div className="blk blk-c">
            <div className="blk-c-top">كرّر <b className="slot">10</b></div>
            <div className="blk-c-inner"><div className="blk blk-move">تحرك <b className="slot">10</b> خطوات</div></div>
            <div className="blk-c-bottom" />
          </div>
        ) : (
          <div className="blk-ghost"><span>؟</span><small>لبنة مفقودة</small></div>
        )}
      </div>
    </div>
  );
}

/* ===================== القفل الإلكتروني ===================== */
export function Padlock({ open, label }: { open: boolean; label: string }) {
  return (
    <div className={`padlock ${open ? 'is-open' : ''}`}>
      <svg viewBox="0 0 80 100" aria-hidden>
        <path className="pl-shackle" d="M20 44 V28 a20 20 0 0 1 40 0 V44" />
        <rect className="pl-body" x="8" y="42" width="64" height="52" rx="12" />
        <circle className="pl-core" cx="40" cy="64" r="8" />
        <rect className="pl-core" x="37" y="68" width="6" height="14" rx="3" />
      </svg>
      <span className="pl-label">{label}</span>
    </div>
  );
}

/* ===================== البوابة الرقمية ===================== */
export function Gate({ open, variant = 'room1', children }: { open: boolean; variant?: 'room1' | 'room2'; children?: React.ReactNode }) {
  return (
    <div className={`gate gate-${variant} ${open ? 'is-open' : ''}`}>
      <div className="gate-light" />
      <div className="gate-door gate-door-a"><i /><i /><i /></div>
      <div className="gate-door gate-door-b"><i /><i /><i /></div>
      <div className="gate-frame" />
      {children}
    </div>
  );
}

/* ===================== القفل النهائي متعدد الطبقات ===================== */
export function CoreLock({ stage }: { stage: number }) {
  // 0 مغلق، 1 إضاءة، 2 دوران، 3 محاذاة ثم فتح
  return (
    <div className={`corelock stage-${stage}`} aria-hidden>
      <svg viewBox="0 0 300 300">
        <defs>
          <radialGradient id="coreGrad"><stop offset="0" stopColor="#fff" /><stop offset=".35" stopColor="#ff6ad5" /><stop offset="1" stopColor="#5b2bff" stopOpacity="0" /></radialGradient>
        </defs>
        <g className="ring ring-1">
          <circle cx="150" cy="150" r="138" />
          {Array.from({ length: 24 }, (_, i) => <rect key={i} x="147" y="6" width="6" height="16" rx="2" transform={`rotate(${i * 15} 150 150)`} />)}
        </g>
        <g className="ring ring-2">
          <circle cx="150" cy="150" r="108" strokeDasharray="60 18" />
          {Array.from({ length: 6 }, (_, i) => <rect key={i} x="140" y="34" width="20" height="10" rx="3" transform={`rotate(${i * 60} 150 150)`} />)}
        </g>
        <g className="ring ring-3">
          <circle cx="150" cy="150" r="78" strokeDasharray="8 10" />
          {Array.from({ length: 3 }, (_, i) => <path key={i} d="M150 64 l10 16 h-20z" transform={`rotate(${i * 120} 150 150)`} />)}
        </g>
        <circle className="core-glow" cx="150" cy="150" r="60" fill="url(#coreGrad)" />
        <g className="core-key">
          <circle cx="150" cy="140" r="16" />
          <rect x="144" y="150" width="12" height="28" rx="4" />
        </g>
      </svg>
    </div>
  );
}

/* ===================== كأس (تصميم أصلي) ===================== */
export function Trophy({ tier }: { tier: 'gold' | 'silver' | 'bronze' }) {
  const id = `tg-${tier}`;
  const c = tier === 'gold' ? ['#fff6c7', '#ffd23f', '#c98a00'] : tier === 'silver' ? ['#ffffff', '#d7e3f4', '#8796ad'] : ['#ffe2c7', '#e39a5a', '#9a5525'];
  return (
    <svg viewBox="0 0 120 140" className={`trophy trophy-${tier}`} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor={c[0]} /><stop offset=".45" stopColor={c[1]} /><stop offset="1" stopColor={c[2]} /></linearGradient>
      </defs>
      <path d="M30 14 H90 V44 a30 30 0 0 1 -60 0 Z" fill={`url(#${id})`} />
      <path d="M30 22 H14 a14 14 0 0 0 16 26 M90 22 H106 a14 14 0 0 1 -16 26" fill="none" stroke={c[1]} strokeWidth="6" strokeLinecap="round" />
      <rect x="52" y="72" width="16" height="22" fill={c[2]} />
      <rect x="34" y="94" width="52" height="12" rx="4" fill={`url(#${id})`} />
      <rect x="26" y="106" width="68" height="20" rx="5" fill={c[2]} />
      <path d="M60 24 l5 10 11 1.5 -8 7.5 2 11 -10 -5.5 -10 5.5 2 -11 -8 -7.5 11 -1.5z" fill="#fff" opacity=".85" />
    </svg>
  );
}

/* ===================== قصاصات احتفالية ===================== */
export function Confetti({ active, density = 1 }: { active: boolean; density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!active) return;
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0;
    const resize = () => { const r = cv.getBoundingClientRect(); const d = Math.min(2, window.devicePixelRatio || 1); w = r.width; h = r.height; cv.width = w * d; cv.height = h * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    resize(); window.addEventListener('resize', resize);
    const colors = ['#7c4dff', '#00e5ff', '#ff4fd8', '#5effa8', '#ffd23f', '#ffffff'];
    const n = Math.round((reduce ? 40 : 160) * density);
    const ps = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: -Math.random() * h, vx: (Math.random() - 0.5) * 2.4, vy: 1.5 + Math.random() * 3,
      r: 4 + Math.random() * 6, a: Math.random() * Math.PI, va: (Math.random() - 0.5) * 0.25, c: colors[Math.floor(Math.random() * colors.length)], shape: Math.random() < 0.3 ? 1 : 0,
    }));
    let raf = 0; const t0 = performance.now();
    const loop = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const fade = t - t0 > 7000;
      for (const p of ps) {
        p.x += p.vx; p.y += p.vy; p.a += p.va; p.vx += Math.sin((t + p.r * 100) / 600) * 0.03;
        if (p.y > h + 20 && !fade) { p.y = -20; p.x = Math.random() * w; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 8;
        if (p.shape) { ctx.beginPath(); ctx.arc(0, 0, p.r * 0.45, 0, Math.PI * 2); ctx.fill(); } else ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
        ctx.restore();
      }
      if (!fade || ps.some((p) => p.y < h + 20)) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); ctx.clearRect(0, 0, w, h); };
  }, [active, density]);
  return <canvas ref={ref} className="confetti" aria-hidden />;
}

/* ===================== جزيئات ضوئية ===================== */
export function Sparks({ active, color = 'cyan' }: { active: boolean; color?: 'cyan' | 'pink' | 'green' }) {
  const parts = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ a: (i / 26) * 360, d: 8 + (i % 5) * 4, delay: (i % 7) * 0.05 })), []);
  if (!active) return null;
  return (
    <div className={`sparks sparks-${color}`} aria-hidden>
      {parts.map((p, i) => (
        <i key={i} style={{ ['--a' as any]: `${p.a}deg`, ['--d' as any]: `calc(var(--u) * ${p.d})`, animationDelay: `${p.delay}s` }} />
      ))}
    </div>
  );
}

export function fmtTime(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
