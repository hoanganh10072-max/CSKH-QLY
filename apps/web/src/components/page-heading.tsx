export function PageHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6 border-b border-cyan-300/10 pb-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 h-1 w-16 rounded-full bg-gradient-to-r from-action via-brand to-violet-400 shadow-neon" />
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{subtitle}</p> : null}
        </div>
      </div>
    </div>
  );
}

