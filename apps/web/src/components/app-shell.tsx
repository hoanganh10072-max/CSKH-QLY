"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearSession, getStoredUser, getToken } from "@/lib/api";
import type { SessionUser } from "@/lib/types";
import { Header } from "@/components/Layout/Header";
import { PageContainer } from "@/components/Layout/PageContainer";
import { Sidebar } from "@/components/Layout/Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getToken();
    const stored = getStoredUser();

    if (!token || !stored) {
      router.replace("/login");
      return;
    }

    setUser(stored);
    setReady(true);
  }, [router]);

  useEffect(() => {
    const refreshUser = () => {
      const stored = getStoredUser();
      if (stored) {
        setUser(stored);
      }
    };

    window.addEventListener("cskh-session-changed", refreshUser);
    return () => window.removeEventListener("cskh-session-changed", refreshUser);
  }, []);

  const logout = () => {
    clearSession();
    router.replace("/login");
  };

  if (!ready || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020817] text-sm text-slate-300">
        <div className="glass-card px-4 py-3">Đang tải phiên làm việc...</div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#020817] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_0%_10%,_rgba(0,212,255,0.20),_transparent_28%),radial-gradient(circle_at_100%_20%,_rgba(0,102,255,0.16),_transparent_34%),radial-gradient(circle_at_50%_100%,_rgba(168,85,247,0.14),_transparent_32%),linear-gradient(135deg,#020817_0%,#061426_48%,#081B33_100%)]" />
      <Sidebar user={user} pathname={pathname} />
      <div className="lg:pl-[260px]">
        <Header user={user} pathname={pathname} onLogout={logout} />
        <PageContainer>{children}</PageContainer>
      </div>
    </div>
  );
}
