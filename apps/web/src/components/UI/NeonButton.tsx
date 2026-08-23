import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "success";

const variants: Record<Variant, string> = {
  primary: "border-cyan-300/[0.45] bg-cyan-400/[0.15] text-cyan-50 shadow-neon hover:bg-cyan-300/[0.22]",
  secondary: "border-white/[0.15] bg-white/[0.08] text-slate-100 hover:border-cyan-300/[0.35] hover:bg-cyan-300/10",
  danger: "border-rose-300/[0.45] bg-rose-400/[0.14] text-rose-50 hover:bg-rose-400/[0.22]",
  success: "border-emerald-300/[0.45] bg-emerald-400/[0.14] text-emerald-50 hover:bg-emerald-400/[0.22]"
};

export function NeonButton({
  children,
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition duration-200 focus-ring disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
