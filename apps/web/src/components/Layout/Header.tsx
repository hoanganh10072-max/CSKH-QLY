"use client";

import clsx from "clsx";
import { Bell, LogOut, Moon } from "lucide-react";
import Link from "next/link";
import type { SessionUser } from "@/lib/types";
import { roleLabels } from "@/lib/types";
import { navigationFor } from "./Sidebar";
import { Avatar } from "@/components/UI/Avatar";
import { Dropdown } from "@/components/UI/Dropdown";
import { NeonButton } from "@/components/UI/NeonButton";

export function Header({ user, pathname, onLogout }: { user: SessionUser; pathname: string; onLogout: () => void }) {
  const nav = navigationFor(user);

  return (
    <header className="sticky top-0 z-40 border-b border-cyan-300/10 bg-[#020817]/90 shadow-[0_14px_36px_rgba(2,8,23,0.45)] backdrop-blur-2xl">
      <div className="flex min-h-20 items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 overflow-x-auto lg:hidden">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "inline-flex h-10 min-w-10 items-center justify-center rounded-lg border px-2 focus-ring",
                      active ? "border-cyan-300/[0.45] bg-cyan-300/[0.12] text-cyan-50 shadow-neon" : "border-white/10 bg-white/[0.06] text-slate-300"
                )}
                title={item.label}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </Link>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button type="button" className="hidden h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-cyan-100 transition hover:border-cyan-300/[0.35] hover:bg-cyan-300/10 md:grid" title="Thông báo">
            <Bell className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className="hidden h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-cyan-100 transition hover:border-cyan-300/[0.35] hover:bg-cyan-300/10 md:grid" title="Giao diện tối">
            <Moon className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="hidden text-right sm:block">
            <div className="text-xs font-semibold uppercase tracking-wide text-cyan-100/[0.55]">Đã đăng nhập</div>
            <div className="mt-0.5 text-sm font-semibold text-white">{user.name}</div>
          </div>
          <Dropdown label={<span className="grid h-10 w-10 place-items-center rounded-lg border border-cyan-300/[0.22] bg-cyan-300/[0.08]"><Avatar name={user.name} className="h-7 w-7 text-[10px]" /></span>}>
            <div className="p-2 text-sm">
              <div className="font-semibold text-white">{user.name}</div>
              <div className="mt-1 break-words text-xs text-slate-400">{user.email}</div>
              <div className="mt-3 inline-flex rounded-full border border-cyan-300/[0.28] bg-cyan-300/[0.10] px-2 py-1 text-xs font-semibold text-cyan-100">{roleLabels[user.role]}</div>
            </div>
          </Dropdown>
          <NeonButton type="button" variant="secondary" onClick={onLogout}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Đăng xuất
          </NeonButton>
        </div>
      </div>
    </header>
  );
}
