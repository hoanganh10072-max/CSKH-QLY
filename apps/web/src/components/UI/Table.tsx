import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

export function GlassTable({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-lg border border-cyan-300/[0.15] bg-slate-950/20 ${className}`}>
      <table className="min-w-full divide-y divide-cyan-300/10 text-sm text-slate-200">{children}</table>
    </div>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="bg-cyan-300/5 text-left text-xs font-semibold uppercase tracking-wide text-cyan-100/75">{children}</thead>;
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-cyan-300/10">{children}</tbody>;
}

export function TableRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <tr className={`transition hover:bg-cyan-300/[0.06] ${className}`}>{children}</tr>;
}

export function Th({ children, className = "", ...props }: ThHTMLAttributes<HTMLTableCellElement> & { children: ReactNode }) {
  return <th {...props} className={`px-4 py-3 ${className}`}>{children}</th>;
}

export function Td({ children, className = "", ...props }: TdHTMLAttributes<HTMLTableCellElement> & { children: ReactNode }) {
  return <td {...props} className={`px-4 py-3 ${className}`}>{children}</td>;
}
