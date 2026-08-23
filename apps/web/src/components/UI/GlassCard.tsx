import type { ReactNode } from "react";

export function GlassCard({
  children,
  className = "",
  hover = false
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <section
      className={`glass-card ${hover ? "transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/[0.45] hover:shadow-glow" : ""} ${className}`}
    >
      {children}
    </section>
  );
}
