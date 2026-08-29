"use client";

import clsx from "clsx";
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  Database,
  FileSpreadsheet,
  LayoutDashboard,
  PhoneCall,
  ShieldCheck,
  UserRound,
  Users
} from "lucide-react";
import Link from "next/link";
import type { SessionUser } from "@/lib/types";
import { roleLabels } from "@/lib/types";
import { Avatar } from "@/components/UI/Avatar";

const staffNav = [
  { href: "/dashboard", label: "Bảng điều khiển", icon: LayoutDashboard },
  { href: "/customers", label: "Nhận dữ liệu khách hàng", icon: Database },
  { href: "/my-customers", label: "Khách hàng của tôi", icon: PhoneCall },
  { href: "/me", label: "Tôi", icon: UserRound }
];

const adminNav = [
  { href: "/dashboard", label: "Bảng điều khiển", icon: LayoutDashboard },
  { href: "/import", label: "Nhập dữ liệu", icon: FileSpreadsheet },
  { href: "/customers", label: "Khách hàng", icon: Database },
  { href: "/employees/customer-care", label: "Nhân viên", icon: Users },
  { href: "/reports", label: "Báo cáo", icon: BarChart3 }
];

const internNav = [
  { href: "/intern/schedule", label: "Đăng kí lịch", icon: CalendarDays },
  { href: "/intern/work", label: "Công việc", icon: ClipboardList },
  { href: "/intern/profile", label: "Hồ sơ cá nhân", icon: UserRound }
];

export const navigationFor = (user: SessionUser) => (
  user.role === "ADMIN" ? adminNav : user.role === "INTERN" ? internNav : staffNav
);

export function Sidebar({ user, pathname }: { user: SessionUser; pathname: string }) {
  const nav = navigationFor(user);

  return (
    <aside className="app-sidebar fixed inset-y-0 left-0 z-20 hidden w-[260px] border-r border-cyan-300/[0.15] bg-[#020817]/70 shadow-glow backdrop-blur-2xl lg:block">
      <div className="absolute inset-y-10 -right-px w-px bg-gradient-to-b from-transparent via-cyan-300/60 to-transparent" />
      <div className="flex h-20 items-center border-b border-cyan-300/10 px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative grid h-12 w-20 shrink-0 place-items-center rounded-lg border border-cyan-300/[0.35] bg-cyan-300/10 text-[11px] font-black text-cyan-50 shadow-neon">
            MSCILABS
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-success shadow-neon" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-white">Quản lý MSCILABS</div>
            <div className="text-xs text-cyan-100/[0.65]">Trung tâm dữ liệu MSCILABS</div>
          </div>
        </div>
      </div>

      <nav className="space-y-1 px-3 py-5">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "group flex h-11 items-center gap-3 rounded-lg border px-3 text-sm font-semibold transition duration-200 focus-ring",
                active
                  ? "border-cyan-300/[0.35] bg-cyan-300/[0.12] text-white shadow-neon"
                  : "border-transparent text-slate-400 hover:border-cyan-300/20 hover:bg-white/[0.06] hover:text-cyan-50"
              )}
            >
              <Icon className={clsx("h-4 w-4", active ? "text-cyan-200" : "text-slate-500 group-hover:text-cyan-200")} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="app-sidebar-profile absolute inset-x-3 bottom-4 rounded-lg border border-cyan-300/[0.15] bg-white/[0.06] p-3 text-xs leading-5 text-slate-300 shadow-glow backdrop-blur-xl">
        <div className="mb-3 flex items-center gap-3">
          <Avatar name={user.name} />
          <div className="min-w-0">
            <div className="truncate font-semibold text-white">{user.name}</div>
            <div className="flex items-center gap-1.5 text-cyan-100/70">
              <span className="h-1.5 w-1.5 rounded-full bg-success shadow-neon" />
              Trực tuyến
            </div>
          </div>
        </div>
        <div className="mb-1 flex items-center gap-2 font-semibold text-cyan-100">
          <ShieldCheck className="h-4 w-4 text-cyan-300" aria-hidden="true" />
          {roleLabels[user.role]}
        </div>
        <div className="break-words text-slate-400">{user.email}</div>
      </div>
    </aside>
  );
}
