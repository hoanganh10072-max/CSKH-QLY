export function DarkChart({
  title,
  values,
  labels,
  className = ""
}: {
  title: string;
  values: number[];
  labels?: string[];
  className?: string;
}) {
  const safeId = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
      const y = 90 - (value / max) * 70;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className={`glass-card ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-xs text-cyan-100">Trực tiếp</span>
      </div>
      <svg viewBox="0 0 100 100" className="h-56 w-full overflow-visible" role="img" aria-label={title}>
        <defs>
          <linearGradient id={`line-${safeId}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#0066FF" />
            <stop offset="55%" stopColor="#00D4FF" />
            <stop offset="100%" stopColor="#A855F7" />
          </linearGradient>
          <filter id={`glow-${safeId}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {[20, 40, 60, 80].map((line) => (
          <line key={line} x1="0" x2="100" y1={line} y2={line} stroke="rgba(148,163,184,0.16)" strokeWidth="0.5" />
        ))}
        <polyline points={points} fill="none" stroke={`url(#line-${safeId})`} strokeWidth="2.5" filter={`url(#glow-${safeId})`} strokeLinecap="round" strokeLinejoin="round" />
        {values.map((value, index) => {
          const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
          const y = 90 - (value / max) * 70;
          return <circle key={`${value}-${index}`} cx={x} cy={y} r="2.6" fill="#00D4FF" stroke="#020817" strokeWidth="1" />;
        })}
      </svg>
      {labels?.length ? (
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-400">
          {labels.map((label) => <span key={label}>{label}</span>)}
        </div>
      ) : null}
    </div>
  );
}
