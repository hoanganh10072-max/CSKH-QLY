"use client";

import clsx from "clsx";
import { Bell, CheckCircle2, Info, LogOut, Moon, RefreshCcw, Sun, Target, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SessionUser, UserRole, UserStatus } from "@/lib/types";
import { roleLabels } from "@/lib/types";
import { apiFetch, describeError } from "@/lib/api";
import { navigationFor } from "./Sidebar";
import { Avatar } from "@/components/UI/Avatar";
import { Dropdown } from "@/components/UI/Dropdown";
import { NeonButton } from "@/components/UI/NeonButton";

type ThemeMode = "dark" | "light";

type HeaderNotification = {
  id: string;
  title: string;
  body: string;
  tone: "warning" | "info" | "success";
  href?: string;
};

type ReceivingSummary = {
  receivedToday: number;
  dailyTarget: number;
  availableCustomers: number;
};

type CustomerCountResponse = {
  pagination: {
    total: number;
  };
};

type EmployeeAccount = Pick<SessionUser, "id" | "name"> & {
  role: UserRole;
  status: UserStatus;
};

type WorkKpiResponse = {
  targetCustomers: number;
  items: Array<{
    userId: string;
    receivedCustomers: number;
    calledCustomers: number;
    successfulCalls: number;
    interestedCustomers: number;
  }>;
};

type TaskResponse = {
  tasks: unknown[];
};

const numberFormat = new Intl.NumberFormat("vi-VN");

const localDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const notificationToneClass = {
  warning: "border-amber-300/25 bg-amber-300/10 text-amber-100",
  info: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
  success: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
};

const notificationIcon = {
  warning: TriangleAlert,
  info: Info,
  success: CheckCircle2
};

export function Header({
  user,
  pathname,
  onLogout,
  theme,
  onToggleTheme
}: {
  user: SessionUser;
  pathname: string;
  onLogout: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}) {
  const nav = navigationFor(user);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<HeaderNotification[]>([]);
  const [notificationError, setNotificationError] = useState("");
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const alertCount = useMemo(
    () => notifications.filter((item) => item.tone !== "success").length,
    [notifications]
  );

  const buildStaffNotifications = async () => {
    const [summary, notCalled] = await Promise.all([
      apiFetch<ReceivingSummary>("/customers/receiving-summary"),
      apiFetch<CustomerCountResponse>("/customers?page=1&pageSize=1&owner=me&callState=not_called")
    ]);

    const items: HeaderNotification[] = [];
    const remainingTarget = Math.max(summary.dailyTarget - summary.receivedToday, 0);
    const notCalledCount = notCalled.pagination.total;

    if (summary.dailyTarget > 0 && remainingTarget > 0) {
      items.push({
        id: "staff-target-missing",
        title: "Chưa đạt chỉ tiêu ngày",
        body: `Hôm nay bạn đã nhận ${numberFormat.format(summary.receivedToday)}/${numberFormat.format(summary.dailyTarget)} khách, còn ${numberFormat.format(remainingTarget)} khách.`,
        tone: "warning",
        href: "/customers"
      });
    } else if (summary.dailyTarget > 0) {
      items.push({
        id: "staff-target-done",
        title: "Đã đạt chỉ tiêu ngày",
        body: `Bạn đã nhận đủ ${numberFormat.format(summary.receivedToday)} khách hôm nay.`,
        tone: "success",
        href: "/customers"
      });
    } else {
      items.push({
        id: "staff-target-empty",
        title: "Chưa đặt chỉ tiêu ngày",
        body: "Quản trị viên chưa thiết lập chỉ tiêu nhận khách cho hôm nay.",
        tone: "info",
        href: "/customers"
      });
    }

    if (notCalledCount > 0) {
      items.push({
        id: "staff-not-called",
        title: "Còn khách hàng chưa gọi",
        body: `Bạn còn ${numberFormat.format(notCalledCount)} khách hàng đã nhận nhưng chưa cập nhật cuộc gọi.`,
        tone: "warning",
        href: "/my-customers"
      });
    }

    if (summary.availableCustomers > 0) {
      items.push({
        id: "staff-available-data",
        title: "Dữ liệu mới đang chờ nhận",
        body: `Hiện còn ${numberFormat.format(summary.availableCustomers)} dữ liệu khách hàng chưa có nhân viên phụ trách.`,
        tone: "info",
        href: "/customers"
      });
    }

    return items;
  };

  const buildAdminNotifications = async () => {
    const today = localDate(new Date());
    const [users, kpis, unassigned, notCalled, overdueTasks, todayTasks] = await Promise.all([
      apiFetch<{ users: EmployeeAccount[] }>("/users"),
      apiFetch<WorkKpiResponse>(`/users/work-kpis?mode=day&period=${today}`),
      apiFetch<CustomerCountResponse>("/customers?page=1&pageSize=1&owner=unassigned"),
      apiFetch<CustomerCountResponse>("/customers?page=1&pageSize=1&owner=assigned&callState=not_called"),
      apiFetch<TaskResponse>("/tasks?status=TODO&due=overdue"),
      apiFetch<TaskResponse>("/tasks?status=TODO&due=today")
    ]);

    const items: HeaderNotification[] = [];
    const staffUsers = users.users.filter((item) => item.role === "STAFF" && item.status === "ACTIVE");
    const kpiByUser = new Map(kpis.items.map((item) => [item.userId, item]));

    if (!staffUsers.length) {
      items.push({
        id: "admin-no-staff",
        title: "Chưa có nhân viên hoạt động",
        body: "Cần tạo tài khoản nhân viên để phân công nhận dữ liệu khách hàng.",
        tone: "info",
        href: "/employees"
      });
    } else if (kpis.targetCustomers > 0) {
      const missed = staffUsers.filter((employee) => {
        const item = kpiByUser.get(employee.id);
        return (item?.receivedCustomers || 0) < kpis.targetCustomers;
      });

      if (missed.length) {
        const names = missed
          .slice(0, 3)
          .map((employee) => {
            const item = kpiByUser.get(employee.id);
            return `${employee.name} ${numberFormat.format(item?.receivedCustomers || 0)}/${numberFormat.format(kpis.targetCustomers)}`;
          })
          .join(", ");
        const suffix = missed.length > 3 ? ` và ${numberFormat.format(missed.length - 3)} nhân viên khác` : "";
        items.push({
          id: "admin-staff-target-missing",
          title: "Nhân viên chưa đạt chỉ tiêu ngày",
          body: `${names}${suffix}.`,
          tone: "warning",
          href: "/employees"
        });
      } else {
        items.push({
          id: "admin-staff-target-done",
          title: "Nhân viên đã đạt chỉ tiêu ngày",
          body: "Toàn bộ nhân viên hoạt động đã đạt chỉ tiêu nhận dữ liệu hôm nay.",
          tone: "success",
          href: "/employees"
        });
      }
    } else {
      items.push({
        id: "admin-target-empty",
        title: "Chưa đặt chỉ tiêu ngày",
        body: "Thiết lập chỉ tiêu chung trong mục Quản lý tiến trình công việc để hệ thống cảnh báo tự động.",
        tone: "info",
        href: "/employees"
      });
    }

    if (unassigned.pagination.total > 0) {
      items.push({
        id: "admin-unassigned-customers",
        title: "Còn dữ liệu chưa có người nhận",
        body: `${numberFormat.format(unassigned.pagination.total)} khách hàng chưa có nhân viên phụ trách.`,
        tone: "info",
        href: "/customers"
      });
    }

    if (notCalled.pagination.total > 0) {
      items.push({
        id: "admin-not-called",
        title: "Khách đã nhận nhưng chưa gọi",
        body: `${numberFormat.format(notCalled.pagination.total)} khách hàng đã được nhận nhưng chưa có lịch sử cuộc gọi.`,
        tone: "warning",
        href: "/customers"
      });
    }

    if (overdueTasks.tasks.length > 0) {
      items.push({
        id: "admin-overdue-tasks",
        title: "Công việc quá hạn",
        body: `${numberFormat.format(overdueTasks.tasks.length)} công việc cần xử lý đã quá hạn.`,
        tone: "warning",
        href: "/tasks"
      });
    } else if (todayTasks.tasks.length > 0) {
      items.push({
        id: "admin-today-tasks",
        title: "Công việc đến hạn hôm nay",
        body: `${numberFormat.format(todayTasks.tasks.length)} công việc cần xử lý trong hôm nay.`,
        tone: "info",
        href: "/tasks"
      });
    }

    return items;
  };

  const loadNotifications = useCallback(async () => {
    setLoadingNotifications(true);
    setNotificationError("");

    try {
      const items = user.role === "STAFF"
        ? await buildStaffNotifications()
        : await buildAdminNotifications();
      setNotifications(items);
    } catch (caught) {
      setNotifications([]);
      setNotificationError(describeError(caught, "Không tải được thông báo"));
    } finally {
      setLoadingNotifications(false);
    }
  }, [user.role]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications, pathname]);

  const ThemeIcon = theme === "dark" ? Sun : Moon;

  return (
    <header className="app-header sticky top-0 z-40 border-b border-cyan-300/10 bg-[#020817]/90 shadow-[0_14px_36px_rgba(2,8,23,0.45)] backdrop-blur-2xl">
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
          <div className="relative hidden md:block">
            <button
              type="button"
              onClick={() => {
                setNotificationOpen((value) => !value);
                loadNotifications();
              }}
              className="top-action-button relative grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-cyan-100 transition hover:border-cyan-300/[0.35] hover:bg-cyan-300/10"
              title="Thông báo"
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
              {alertCount > 0 ? (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-neon">
                  {alertCount > 9 ? "9+" : alertCount}
                </span>
              ) : null}
            </button>

            {notificationOpen ? (
              <div className="notification-panel absolute right-0 z-50 mt-2 w-[360px] overflow-hidden rounded-lg border border-cyan-300/[0.16] bg-[#061426]/95 shadow-glow backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3 border-b border-cyan-300/10 px-3 py-2.5">
                  <div>
                    <div className="text-sm font-semibold text-white">Thông báo</div>
                    <div className="text-xs text-slate-400">Tự động theo dõi chỉ tiêu và dữ liệu MSCILABS</div>
                  </div>
                  <button
                    type="button"
                    onClick={loadNotifications}
                    disabled={loadingNotifications}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-cyan-300/[0.24] bg-cyan-300/[0.08] px-2 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-300/[0.14] disabled:opacity-60"
                  >
                    <RefreshCcw className={clsx("h-3.5 w-3.5", loadingNotifications && "animate-spin")} aria-hidden="true" />
                    Tải lại
                  </button>
                </div>

                <div className="max-h-[420px] space-y-2 overflow-y-auto p-2">
                  {notificationError ? (
                    <div className="rounded-lg border border-rose-300/25 bg-rose-500/10 p-3 text-sm text-rose-100 whitespace-pre-line">
                      {notificationError}
                    </div>
                  ) : loadingNotifications && !notifications.length ? (
                    <div className="rounded-lg border border-cyan-300/15 bg-cyan-300/5 p-3 text-sm text-slate-300">
                      Đang tải thông báo...
                    </div>
                  ) : notifications.length ? (
                    notifications.map((item) => {
                      const Icon = notificationIcon[item.tone];
                      const content = (
                        <div className={clsx("rounded-lg border p-3 transition", notificationToneClass[item.tone], item.href && "hover:bg-white/[0.08]")}>
                          <div className="flex items-start gap-2">
                            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                            <div className="min-w-0">
                              <div className="text-sm font-semibold">{item.title}</div>
                              <div className="mt-1 text-xs leading-5 text-slate-300">{item.body}</div>
                            </div>
                          </div>
                        </div>
                      );

                      return item.href ? (
                        <Link key={item.id} href={item.href} onClick={() => setNotificationOpen(false)}>
                          {content}
                        </Link>
                      ) : (
                        <div key={item.id}>{content}</div>
                      );
                    })
                  ) : (
                    <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-100">
                      Không có cảnh báo mới.
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            className="top-action-button hidden h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-cyan-100 transition hover:border-cyan-300/[0.35] hover:bg-cyan-300/10 md:grid"
            title={theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
          >
            <ThemeIcon className="h-4 w-4" aria-hidden="true" />
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
