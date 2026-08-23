import type { ReactNode } from "react";

export function PageContainer({ children }: { children: ReactNode }) {
  return <main className="relative z-10 px-4 py-5 sm:px-6 lg:px-8">{children}</main>;
}
