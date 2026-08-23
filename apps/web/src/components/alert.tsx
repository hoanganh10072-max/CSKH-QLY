import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

type AlertKind = "error" | "success" | "warning" | "info";

const styles: Record<AlertKind, string> = {
  error: "border-rose-300/[0.35] bg-rose-400/[0.12] text-rose-50 shadow-[0_0_26px_rgba(244,63,94,0.16)]",
  success: "border-emerald-300/[0.35] bg-emerald-300/[0.12] text-emerald-50 shadow-[0_0_26px_rgba(16,185,129,0.16)]",
  warning: "border-amber-300/[0.35] bg-amber-300/[0.12] text-amber-50 shadow-[0_0_26px_rgba(251,191,36,0.16)]",
  info: "border-cyan-300/[0.35] bg-cyan-300/[0.12] text-cyan-50 shadow-[0_0_26px_rgba(0,212,255,0.16)]"
};

const icons = {
  error: AlertCircle,
  success: CheckCircle2,
  warning: TriangleAlert,
  info: Info
};

export function Alert({
  kind,
  title,
  children,
  className = ""
}: {
  kind: AlertKind;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const Icon = icons[kind];

  return (
    <div className={`rounded-lg border p-3 text-sm backdrop-blur-xl ${styles[kind]} ${className}`} role={kind === "error" ? "alert" : "status"} aria-live="polite">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <div className="font-semibold">{title}</div>
          <div className="mt-1 whitespace-pre-wrap break-words leading-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function ErrorAlert({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Alert kind="error" title="Lỗi cần xử lý" className={className}>
      {children}
    </Alert>
  );
}

export function SuccessAlert({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Alert kind="success" title="Đã cập nhật" className={className}>
      {children}
    </Alert>
  );
}

export function WarningAlert({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Alert kind="warning" title="Cần chú ý" className={className}>
      {children}
    </Alert>
  );
}
