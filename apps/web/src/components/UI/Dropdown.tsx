import type { ReactNode } from "react";

export function Dropdown({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-lg focus-ring">{label}</summary>
      <div className="absolute right-0 z-30 mt-2 min-w-48 rounded-lg border border-cyan-300/[0.15] bg-[#061426]/95 p-2 shadow-glow backdrop-blur-xl">
        {children}
      </div>
    </details>
  );
}
