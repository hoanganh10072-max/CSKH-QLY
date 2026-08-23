import type { ReactNode } from "react";

type Tone = "cyan" | "green" | "amber" | "rose" | "violet" | "slate";

const tones: Record<Tone, string> = {
  cyan: "border-cyan-300/[0.35] bg-cyan-300/[0.12] text-cyan-100",
  green: "border-emerald-300/[0.35] bg-emerald-300/[0.12] text-emerald-100",
  amber: "border-amber-300/[0.35] bg-amber-300/[0.12] text-amber-100",
  rose: "border-rose-300/[0.35] bg-rose-300/[0.12] text-rose-100",
  violet: "border-violet-300/[0.35] bg-violet-300/[0.12] text-violet-100",
  slate: "border-white/[0.15] bg-white/[0.08] text-slate-200"
};

export function Badge({ children, tone = "cyan", className = "" }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}
