import type { ReactNode } from "react";
import { X } from "lucide-react";
import { NeonButton } from "./NeonButton";

export function Modal({
  open,
  title,
  children,
  onClose
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="glass-card w-full max-w-lg">
        <div className="flex items-center justify-between border-b border-cyan-300/10 px-5 py-4">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <NeonButton type="button" variant="secondary" className="h-9 w-9 px-0" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
          </NeonButton>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
