"use client";

import { CalendarDays, CircleDollarSign, ClipboardList, Eye, MessageSquareText, PhoneCall, Plus, Save, Trash2, Users, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { ErrorAlert, SuccessAlert, WarningAlert } from "@/components/alert";
import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { Avatar } from "@/components/UI/Avatar";
import { GlassCard } from "@/components/UI/GlassCard";
import { Input } from "@/components/UI/Input";
import { NeonButton } from "@/components/UI/NeonButton";
import { Select } from "@/components/UI/Select";
import { GlassTable, TableBody, TableHead, TableRow, Td, Th } from "@/components/UI/Table";
import { apiFetch, describeError, getStoredUser } from "@/lib/api";
import { notifyDataChanged, useLiveRefresh } from "@/lib/live-sync";
import type { SessionUser, UserRole } from "@/lib/types";
import { roleLabels } from "@/lib/types";

type DayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

type ScheduleDay = {
  working: boolean;
  start: string;
  end: string;
};

type WeeklySchedule = {
  id?: string;
  userId?: string;
  weekStart: string;
  note: string;
  days: Record<DayKey, ScheduleDay>;
  updatedAt?: string;
};

type KpiFilterMode = "day" | "month" | "year";
type ShiftPeriod = "morning" | "afternoon";
type WorkingEmployee = { employee: Employee; day: ScheduleDay; note: string };

type WorkProgressKpi = {
  userId: string;
  receivedCustomers: number;
  calledCustomers: number;
  successfulCalls: number;
  interestedCustomers: number;
};

type Employee = SessionUser & {
  createdAt: string;
  revenue: number;
  _count: {
    ownedCustomers: number;
    interactions: number;
    tasks: number;
  };
};

const currencyFormat = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0
});

const dateFormat = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

const compactDateFormat = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit"
});

const formatOptionalDate = (value?: string | null) => {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
  return dateFormat.format(date);
};

const dayItems: Array<{ key: DayKey; label: string }> = [
  { key: "monday", label: "Thứ hai" },
  { key: "tuesday", label: "Thứ ba" },
  { key: "wednesday", label: "Thứ tư" },
  { key: "thursday", label: "Thứ năm" },
  { key: "friday", label: "Thứ sáu" },
  { key: "saturday", label: "Thứ bảy" },
  { key: "sunday", label: "Chủ nhật" }
];

const shiftItems: Array<{ key: ShiftPeriod; label: string; emptyLabel: string; start: number; end: number }> = [
  { key: "morning", label: "Sáng", emptyLabel: "Chưa có lịch sáng", start: 0, end: 12 * 60 },
  { key: "afternoon", label: "Chiều", emptyLabel: "Chưa có lịch chiều", start: 12 * 60, end: 24 * 60 }
];

const localDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const mondayOfWeek = (date: Date) => {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
};

const normalizeWeekStart = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return localDate(mondayOfWeek(date));
};

const defaultWeekStart = () => localDate(mondayOfWeek(new Date()));

const timeToMinutes = (value: string) => {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

const minutesToTime = (value: number) => {
  const bounded = Math.max(0, Math.min(value, 24 * 60));
  const hours = Math.floor(bounded / 60);
  const minutes = bounded % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const normalizedScheduleRange = (day: ScheduleDay) => {
  const start = timeToMinutes(day.start);
  const end = timeToMinutes(day.end);
  if (start === null || end === null) return null;
  return { start, end: end <= start ? 24 * 60 : end };
};

const isWorkingInShift = (day: ScheduleDay, shift: (typeof shiftItems)[number]) => {
  const range = normalizedScheduleRange(day);
  if (!range) return false;
  return range.start < shift.end && range.end > shift.start;
};

const formatShiftTime = (day: ScheduleDay, shift: (typeof shiftItems)[number]) => {
  const range = normalizedScheduleRange(day);
  if (!range) return `${day.start} đến ${day.end}`;
  const start = Math.max(range.start, shift.start);
  const end = Math.min(range.end, shift.end);
  return `${minutesToTime(start)} đến ${minutesToTime(end)}`;
};

const defaultKpiPeriod = (mode: KpiFilterMode) => {
  const today = new Date();
  if (mode === "year") return String(today.getFullYear());
  if (mode === "month") return localDate(today).slice(0, 7);
  return localDate(today);
};

const numberFromInput = (value: string) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) return 0;
  return numberValue;
};

const emptyWorkProgressKpi = (userId: string): WorkProgressKpi => ({
  userId,
  receivedCustomers: 0,
  calledCustomers: 0,
  successfulCalls: 0,
  interestedCustomers: 0
});

export default function EmployeesPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingWeeklySchedules, setLoadingWeeklySchedules] = useState(false);
  const [loadingDailyKpis, setLoadingDailyKpis] = useState(false);
  const [savingKpiTarget, setSavingKpiTarget] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [viewEmployeeId, setViewEmployeeId] = useState("");
  const [createForm, setCreateForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "1",
    role: "STAFF" as UserRole
  });
  const [weekStart, setWeekStart] = useState(defaultWeekStart);
  const [kpiMode, setKpiMode] = useState<KpiFilterMode>("day");
  const [kpiPeriod, setKpiPeriod] = useState(defaultKpiPeriod("day"));
  const [kpiTarget, setKpiTarget] = useState("0");
  const [weeklySchedules, setWeeklySchedules] = useState<Record<string, WeeklySchedule>>({});
  const [dailyKpis, setDailyKpis] = useState<Record<string, WorkProgressKpi>>({});
  const optimisticEmployeesRef = useRef<Record<string, Employee>>({});

  const viewedEmployee = useMemo(
    () => employees.find((employee) => employee.id === viewEmployeeId) || null,
    [employees, viewEmployeeId]
  );

  const totals = useMemo(() => {
    return employees.reduce(
      (summary, employee) => ({
        activeCustomers: summary.activeCustomers + employee._count.ownedCustomers,
        consultations: summary.consultations + employee._count.interactions,
        revenue: summary.revenue + Number(employee.revenue || 0)
      }),
      { activeCustomers: 0, consultations: 0, revenue: 0 }
    );
  }, [employees]);

  const load = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    if (!silent) setError("");
    try {
      const data = await apiFetch<{ users: Employee[] }>("/users");
      const optimisticEmployees = Object.values(optimisticEmployeesRef.current);
      const mergedUsers = [
        ...optimisticEmployees.filter((employee) => !data.users.some((item) => item.id === employee.id)),
        ...data.users
      ];

      setEmployees(mergedUsers);
      setSelectedId((current) => {
        if (current && mergedUsers.some((employee) => employee.id === current)) return current;
        return mergedUsers[0]?.id || "";
      });
    } catch (caught) {
      if (!silent) setError(describeError(caught, "Không tải được danh sách nhân viên"));
    } finally {
      setLoading(false);
    }
  };

  const loadWeeklySchedules = async (targetWeekStart: string, { silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoadingWeeklySchedules(true);
    if (!silent) setError("");
    try {
      const data = await apiFetch<{ schedules: WeeklySchedule[] }>(`/users/schedules?weekStart=${encodeURIComponent(targetWeekStart)}`);
      setWeeklySchedules(
        Object.fromEntries(data.schedules.filter((item) => item.userId).map((item) => [item.userId as string, item]))
      );
    } catch (caught) {
      if (!silent) {
        setWeeklySchedules({});
        setError(describeError(caught, "Không tải được bảng lịch làm việc tuần"));
      }
    } finally {
      if (!silent) setLoadingWeeklySchedules(false);
    }
  };

  const loadDailyKpis = async (mode: KpiFilterMode, period: string, { silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoadingDailyKpis(true);
    if (!silent) setError("");
    try {
      const data = await apiFetch<{ targetCustomers: number; items: WorkProgressKpi[] }>(
        `/users/work-kpis?mode=${encodeURIComponent(mode)}&period=${encodeURIComponent(period)}`
      );
      setKpiTarget(String(data.targetCustomers || 0));
      setDailyKpis(Object.fromEntries(data.items.map((item) => [item.userId, item])));
    } catch (caught) {
      if (!silent) {
        setDailyKpis({});
        setError(describeError(caught, "Không tải được KPI hằng ngày"));
      }
    } finally {
      if (!silent) setLoadingDailyKpis(false);
    }
  };

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);
    if (stored?.role === "ADMIN") {
      load();
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role !== "ADMIN" || !employees.length) {
      setWeeklySchedules({});
      return;
    }

    loadWeeklySchedules(weekStart);
  }, [user?.role, employees, weekStart]);

  useEffect(() => {
    if (user?.role !== "ADMIN" || !employees.length || !kpiPeriod) {
      setDailyKpis({});
      return;
    }

    loadDailyKpis(kpiMode, kpiPeriod);
  }, [user?.role, employees, kpiMode, kpiPeriod]);

  useLiveRefresh(async () => {
    if (user?.role !== "ADMIN") return;
    await load({ silent: true });
    if (employees.length) {
      await Promise.all([
        loadWeeklySchedules(weekStart, { silent: true }),
        kpiPeriod ? loadDailyKpis(kpiMode, kpiPeriod, { silent: true }) : Promise.resolve()
      ]);
    }
  }, {
    enabled: user?.role === "ADMIN",
    intervalMs: 10000,
    areas: ["customers", "interactions", "users", "tasks", "dashboard"]
  });

  const createEmployee = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const data = await apiFetch<{ user: Employee }>("/users", { method: "POST", json: { ...createForm, role: "STAFF" } });
      const createdEmployee: Employee = {
        ...data.user,
        revenue: Number(data.user.revenue || 0),
        _count: data.user._count || {
          ownedCustomers: 0,
          interactions: 0,
          tasks: 0
        }
      };

      optimisticEmployeesRef.current = {
        ...optimisticEmployeesRef.current,
        [createdEmployee.id]: createdEmployee
      };
      setEmployees((current) => [
        createdEmployee,
        ...current.filter((employee) => employee.id !== createdEmployee.id)
      ]);
      setLoading(false);
      setSelectedId(createdEmployee.id);
      setCreateForm({ name: "", username: "", email: "", password: "1", role: "STAFF" });
      setMessage("Đã tạo tài khoản nhân viên.");
      notifyDataChanged({ area: "users", source: "create-employee" });
    } catch (caught) {
      setError(describeError(caught, "Không thể tạo nhân viên"));
    }
  };

  const changeKpiMode = (mode: KpiFilterMode) => {
    setKpiMode(mode);
    setKpiPeriod(defaultKpiPeriod(mode));
  };

  const saveKpiTarget = async () => {
    setSavingKpiTarget(true);
    setError("");
    setMessage("");
    try {
      const data = await apiFetch<{ target: { targetCustomers: number } }>("/users/work-kpis/target", {
        method: "PUT",
        json: {
          mode: kpiMode,
          period: kpiPeriod,
          targetCustomers: Math.trunc(numberFromInput(kpiTarget))
        }
      });
      setKpiTarget(String(data.target.targetCustomers || 0));
      setMessage("Đã lưu chỉ tiêu chung cho toàn bộ nhân viên.");
      notifyDataChanged({ area: "users", source: "save-kpi-target" });
      await loadDailyKpis(kpiMode, kpiPeriod);
    } catch (caught) {
      setError(describeError(caught, "Không thể lưu chỉ tiêu chung"));
    } finally {
      setSavingKpiTarget(false);
    }
  };

  const viewEmployeeInfo = (employee: Employee) => {
    setViewEmployeeId(employee.id);
    setSelectedId(employee.id);
  };

  const deleteEmployee = async (employee: Employee) => {
    if (employee.id === user?.id) {
      setError("Không thể xóa tài khoản đang đăng nhập.");
      return;
    }

    const confirmed = window.confirm(`Xóa tài khoản của ${employee.name}? Tài khoản này sẽ không còn đăng nhập được và không còn hiện trong danh sách.`);
    if (!confirmed) return;

    setDeletingId(employee.id);
    setError("");
    setMessage("");
    try {
      await apiFetch(`/users/${employee.id}`, { method: "DELETE" });
      const nextOptimisticEmployees = { ...optimisticEmployeesRef.current };
      delete nextOptimisticEmployees[employee.id];
      optimisticEmployeesRef.current = nextOptimisticEmployees;
      const nextEmployees = employees.filter((item) => item.id !== employee.id);
      setEmployees(nextEmployees);
      setWeeklySchedules((old) => {
        const next = { ...old };
        delete next[employee.id];
        return next;
      });
      if (selectedId === employee.id) {
        const nextSelectedId = nextEmployees[0]?.id || "";
        setSelectedId(nextSelectedId);
      }
      if (viewEmployeeId === employee.id) setViewEmployeeId("");
      setMessage(`Đã xóa tài khoản của ${employee.name}.`);
      notifyDataChanged({ area: "users", source: "delete-employee" });
    } catch (caught) {
      setError(describeError(caught, "Không thể xóa tài khoản"));
    } finally {
      setDeletingId("");
    }
  };

  return (
    <AppShell>
      <PageHeading title="Nhân viên" subtitle="Quản lý tài khoản nhân viên, lịch làm việc và hiệu suất nhân viên." />

      {!user ? (
        <div className="glass-card p-4 text-sm text-slate-400">Đang tải quyền truy cập...</div>
      ) : user.role !== "ADMIN" ? (
        <WarningAlert>Chỉ quản trị viên được quản lý nhân viên.</WarningAlert>
      ) : (
        <div className="space-y-5">
          <section className="grid gap-4 md:grid-cols-3">
            <MetricCard label="Khách hàng đang chăm sóc" value={String(totals.activeCustomers)} icon={PhoneCall} tone="cyan" />
            <MetricCard label="Tư vấn khách hàng" value={String(totals.consultations)} icon={MessageSquareText} tone="violet" />
            <MetricCard label="Doanh thu nhân viên" value={currencyFormat.format(totals.revenue)} icon={CircleDollarSign} tone="emerald" />
          </section>

          {error ? <ErrorAlert>{error}</ErrorAlert> : null}
          {message ? <SuccessAlert>{message}</SuccessAlert> : null}

          <WeeklyScheduleOverview
            employees={employees}
            schedules={weeklySchedules}
            weekStart={weekStart}
            setWeekStart={setWeekStart}
            loading={(loading && !employees.length) || loadingWeeklySchedules}
            selectedId={selectedId}
            onSelectEmployee={setSelectedId}
          />

          <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_400px]">
            <div className="space-y-5">
              <GlassCard>
                <div className="flex items-center gap-2 border-b border-cyan-300/10 px-4 py-3">
                  <Users className="h-4 w-4 text-brand" aria-hidden="true" />
                  <h2 className="text-base font-semibold text-white">Quản lý tài khoản nhân viên</h2>
                </div>
                <GlassTable className="border-0">
                  <TableHead>
                    <tr>
                      <Th>Nhân viên</Th>
                      <Th>Tài khoản</Th>
                      <Th>Mật khẩu</Th>
                      <Th>Vai trò</Th>
                      <Th>Trạng thái</Th>
                      <Th className="text-right">Thao tác</Th>
                    </tr>
                  </TableHead>
                  <TableBody>
                    {loading && !employees.length ? (
                      <tr><Td className="py-6 text-slate-400" colSpan={6}>Đang tải...</Td></tr>
                    ) : employees.length ? employees.map((employee) => (
                      <TableRow key={employee.id} className={selectedId === employee.id ? "bg-cyan-300/[0.06]" : ""}>
                        <Td>
                          <div className="flex items-center gap-3">
                            <Avatar name={employee.name} />
                            <div>
                              <div className="font-medium text-white">{employee.name}</div>
                              <div className="text-xs text-slate-400">{employee.email}</div>
                            </div>
                          </div>
                        </Td>
                        <Td className="font-semibold text-cyan-50">{employee.username || "-"}</Td>
                        <Td>
                          <div className="inline-flex rounded-full border border-emerald-300/[0.28] bg-emerald-300/[0.10] px-2.5 py-1 text-xs font-semibold text-emerald-100">
                            Đã thiết lập
                          </div>
                        </Td>
                        <Td className="text-slate-300">{roleLabels[employee.role]}</Td>
                        <Td><StatusBadge status={employee.status} /></Td>
                        <Td>
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => viewEmployeeInfo(employee)}
                              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-cyan-300/[0.35] bg-cyan-300/[0.10] px-3 py-2 text-sm font-semibold leading-tight text-cyan-50 transition hover:bg-cyan-300/[0.16] focus-ring"
                            >
                              <Eye className="h-4 w-4" aria-hidden="true" />
                              Xem thông tin nhân viên
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteEmployee(employee)}
                              disabled={deletingId === employee.id || employee.id === user.id}
                              title={employee.id === user.id ? "Không thể xóa tài khoản đang đăng nhập" : undefined}
                              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-rose-300/[0.35] bg-rose-500/[0.10] px-3 py-2 text-sm font-semibold leading-tight text-rose-50 transition hover:bg-rose-500/[0.16] disabled:cursor-not-allowed disabled:opacity-50 focus-ring"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                              {deletingId === employee.id ? "Đang xóa..." : "Xóa tài khoản"}
                            </button>
                          </div>
                        </Td>
                      </TableRow>
                    )) : (
                      <tr><Td className="py-6 text-slate-400" colSpan={6}>Chưa có nhân viên.</Td></tr>
                    )}
                  </TableBody>
                </GlassTable>
              </GlassCard>

              <WorkProgressManager
                employees={employees}
                mode={kpiMode}
                setMode={changeKpiMode}
                period={kpiPeriod}
                setPeriod={setKpiPeriod}
                target={kpiTarget}
                setTarget={setKpiTarget}
                kpis={dailyKpis}
                loading={loadingDailyKpis}
                savingTarget={savingKpiTarget}
                onSaveTarget={saveKpiTarget}
              />
            </div>

            <div className="space-y-5">
              <CreateEmployeeForm form={createForm} setForm={setCreateForm} onSubmit={createEmployee} />
            </div>
          </div>

          {viewedEmployee ? (
            <EmployeeInfoDialog
              employee={viewedEmployee}
              onClose={() => setViewEmployeeId("")}
            />
          ) : null}
        </div>
      )}
    </AppShell>
  );
}

function MetricCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: LucideIcon; tone: "cyan" | "violet" | "emerald" }) {
  const toneClass = {
    cyan: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
    violet: "border-violet-300/20 bg-violet-300/10 text-violet-100",
    emerald: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
  }[tone];

  return (
    <GlassCard className="p-4" hover>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-slate-400">{label}</div>
          <div className="mt-2 text-3xl font-semibold text-white">{value}</div>
        </div>
        <div className={`grid h-11 w-11 place-items-center rounded-lg border shadow-neon ${toneClass}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
    </GlassCard>
  );
}

function EmployeeInfoDialog({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="glass-card max-h-[calc(100vh-48px)] w-full max-w-5xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-cyan-300/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <Avatar name={employee.name} />
            <div>
              <h2 className="text-lg font-semibold text-white">Thông tin nhân viên</h2>
              <p className="text-sm text-slate-400">{employee.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg border border-cyan-300/[0.20] bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08] focus-ring"
            aria-label="Đóng thông tin nhân viên"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid max-h-[calc(100vh-150px)] gap-3 overflow-auto p-5 sm:grid-cols-2 xl:grid-cols-3">
          <InfoItem label="Họ tên" value={employee.name} />
          <InfoItem label="Tên đăng nhập" value={employee.username || "Chưa thiết lập"} />
          <InfoItem label="Bộ phận" value={employee.department || "Chưa cập nhật"} />
          <InfoItem label="Ngày vào làm" value={formatOptionalDate(employee.startDate)} />
          <InfoItem label="Thư điện tử" value={employee.email} />
          <InfoItem label="Số điện thoại" value={employee.phone || "Chưa cập nhật"} />
          <InfoItem label="Nơi ở hiện tại" value={employee.currentAddress || "Chưa cập nhật"} />
          <InfoItem label="Quê quán" value={employee.hometown || "Chưa cập nhật"} />
          <InfoItem label="Ngày sinh" value={formatOptionalDate(employee.dateOfBirth)} />
          <InfoItem label="Giới tính" value={employee.gender || "Chưa cập nhật"} />
          <InfoItem label="Số CCCD/CMND" value={employee.citizenId || "Chưa cập nhật"} />
          <InfoItem label="Ngày cấp" value={formatOptionalDate(employee.citizenIssuedDate)} />
          <InfoItem label="Nơi cấp" value={employee.citizenIssuedPlace || "Chưa cập nhật"} />
          <InfoItem label="Số tài khoản" value={employee.bankAccountNumber || "Chưa cập nhật"} />
          <InfoItem label="Tên ngân hàng" value={employee.bankName || "Chưa cập nhật"} />
          <InfoItem label="Tên chủ tài khoản" value={employee.bankAccountHolder || "Chưa cập nhật"} />
          <InfoItem label="Vai trò" value={roleLabels[employee.role]} />
          <InfoItem label="Trạng thái" value={<StatusBadge status={employee.status} />} />
          <InfoItem label="Khách hàng đang chăm sóc" value={String(employee._count.ownedCustomers)} />
          <InfoItem label="Tư vấn khách hàng" value={String(employee._count.interactions)} />
          <InfoItem label="Doanh thu" value={currencyFormat.format(Number(employee.revenue || 0))} />
          <InfoItem label="Công việc" value={String(employee._count.tasks)} />
          <InfoItem label="Ngày tạo tài khoản" value={dateFormat.format(new Date(employee.createdAt))} />
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string | ReactNode }) {
  return (
    <div className="rounded-lg border border-cyan-300/[0.12] bg-white/[0.04] px-3 py-2">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function WeeklyScheduleOverview({
  employees,
  schedules,
  weekStart,
  setWeekStart,
  loading,
  selectedId,
  onSelectEmployee
}: {
  employees: Employee[];
  schedules: Record<string, WeeklySchedule>;
  weekStart: string;
  setWeekStart: (value: string) => void;
  loading: boolean;
  selectedId: string;
  onSelectEmployee: (id: string) => void;
}) {
  const weekBase = new Date(`${weekStart}T00:00:00`);
  const days = dayItems.map((item, index) => {
    const date = new Date(weekBase);
    date.setDate(weekBase.getDate() + index);

    const workingEmployees = employees
      .map((employee) => {
        const day = schedules[employee.id]?.days[item.key];
        if (!day?.working) return null;

        return {
          employee,
          day,
          note: schedules[employee.id]?.note || ""
        };
      })
      .filter(Boolean) as WorkingEmployee[];

    const shifts = shiftItems.map((shift) => ({
      ...shift,
      workingEmployees: workingEmployees.filter(({ day }) => isWorkingInShift(day, shift))
    }));

    return {
      ...item,
      date,
      workingEmployees,
      shifts
    };
  });

  return (
    <GlassCard>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-300/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-brand" aria-hidden="true" />
          <h2 className="text-base font-semibold text-white">Bảng lịch làm việc tuần</h2>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <span>Tuần bắt đầu</span>
          <Input
            type="date"
            value={weekStart}
            onChange={(event) => setWeekStart(normalizeWeekStart(event.target.value))}
            className="w-40"
          />
        </label>
      </div>
      {loading ? (
        <div className="p-4 text-sm text-slate-400">Đang tải bảng lịch làm việc...</div>
      ) : employees.length ? (
        <div className="weekly-calendar-grid grid gap-px overflow-hidden rounded-b-lg bg-cyan-300/10 md:grid-cols-2 xl:grid-cols-7">
          {days.map((item) => (
            <section key={item.key} className="weekly-calendar-day min-h-72 bg-slate-950/55 p-3">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold uppercase text-cyan-100">{item.label}</h3>
                  <div className="mt-1 text-2xl font-semibold text-white">{compactDateFormat.format(item.date)}</div>
                </div>
                <span className="rounded-full border border-cyan-300/[0.24] bg-cyan-300/[0.10] px-2.5 py-1 text-xs font-semibold text-cyan-100">
                  {item.workingEmployees.length} người
                </span>
              </div>

              <div className="space-y-3">
                {item.shifts.map((shift) => (
                  <div
                    key={`${item.key}-${shift.key}`}
                    className="weekly-calendar-period rounded-xl border border-cyan-300/[0.14] bg-slate-900/35 p-2.5"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold uppercase text-cyan-100">{shift.label}</h4>
                      <span className="rounded-full border border-cyan-300/[0.22] bg-cyan-300/[0.08] px-2 py-0.5 text-[11px] font-semibold text-cyan-100">
                        {shift.workingEmployees.length} người
                      </span>
                    </div>

                    {shift.workingEmployees.length ? (
                      <div className="space-y-2">
                        {shift.workingEmployees.map(({ employee, day, note }) => (
                          <button
                            key={`${item.key}-${shift.key}-${employee.id}`}
                            type="button"
                            onClick={() => onSelectEmployee(employee.id)}
                            className={`weekly-calendar-shift-card w-full rounded-lg border p-3 text-left transition hover:border-cyan-300/45 hover:bg-cyan-300/[0.10] focus-ring ${
                              selectedId === employee.id
                                ? "border-cyan-300/[0.45] bg-cyan-300/[0.12]"
                                : "border-emerald-300/[0.22] bg-emerald-300/[0.07]"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Avatar name={employee.name} className="h-8 w-8 text-[10px]" />
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-white">{employee.name}</div>
                                <div className="text-xs text-slate-400">{roleLabels[employee.role]}</div>
                              </div>
                            </div>
                            <div className="weekly-calendar-time mt-3 rounded-lg border border-emerald-300/[0.18] bg-emerald-300/[0.10] px-2.5 py-2 text-center text-sm font-semibold text-emerald-100">
                              {formatShiftTime(day, shift)}
                            </div>
                            {note ? <div className="mt-2 line-clamp-2 text-xs text-slate-400">{note}</div> : null}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="weekly-calendar-empty weekly-calendar-shift-empty grid min-h-20 place-items-center rounded-lg border border-slate-500/20 bg-slate-500/[0.08] px-3 text-center text-xs font-medium text-slate-400">
                        {shift.emptyLabel}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="p-4 text-sm text-slate-400">Chưa có nhân viên.</div>
      )}
    </GlassCard>
  );
}

function WorkProgressManager({
  employees,
  mode,
  setMode,
  period,
  setPeriod,
  target,
  setTarget,
  kpis,
  loading,
  savingTarget,
  onSaveTarget
}: {
  employees: Employee[];
  mode: KpiFilterMode;
  setMode: (value: KpiFilterMode) => void;
  period: string;
  setPeriod: (value: string) => void;
  target: string;
  setTarget: (value: string) => void;
  kpis: Record<string, WorkProgressKpi>;
  loading: boolean;
  savingTarget: boolean;
  onSaveTarget: () => void;
}) {
  const periodInputType = mode === "day" ? "date" : mode === "month" ? "month" : "number";
  const periodLabel = mode === "day" ? "Ngày" : mode === "month" ? "Tháng" : "Năm";

  return (
    <GlassCard>
      <div className="border-b border-cyan-300/10 px-4 py-3">
        <div className="mb-3 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-brand" aria-hidden="true" />
          <h2 className="text-base font-semibold text-white">Quản lý tiến trình công việc</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-[170px_170px_170px_auto]">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-300">Bộ lọc</span>
            <Select value={mode} onChange={(event) => setMode(event.target.value as KpiFilterMode)}>
              <option value="day">Theo ngày</option>
              <option value="month">Theo tháng</option>
              <option value="year">Theo năm</option>
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-300">{periodLabel}</span>
            <Input
              type={periodInputType}
              min={mode === "year" ? "2020" : undefined}
              max={mode === "year" ? "2100" : undefined}
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-300">Chỉ tiêu chung</span>
            <Input
              type="number"
              min="0"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={onSaveTarget}
              disabled={savingTarget || !period}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-cyan-300/[0.35] bg-cyan-300/[0.10] px-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/[0.16] disabled:cursor-not-allowed disabled:opacity-60 focus-ring"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              {savingTarget ? "Đang lưu..." : "Lưu chỉ tiêu"}
            </button>
          </div>
        </div>
      </div>
      <GlassTable className="border-0">
        <TableHead>
          <tr>
            <Th>Nhân viên</Th>
            <Th className="text-right">Chỉ tiêu</Th>
            <Th className="text-right">Đã nhận</Th>
            <Th className="text-right">Đã gọi</Th>
            <Th className="text-right">Gọi được</Th>
            <Th className="text-right">Quan tâm</Th>
          </tr>
        </TableHead>
        <TableBody>
          {loading ? (
            <tr><Td className="py-6 text-slate-400" colSpan={6}>Đang tải tiến trình công việc...</Td></tr>
          ) : employees.length ? employees.map((employee) => {
            const item = kpis[employee.id] || emptyWorkProgressKpi(employee.id);

            return (
              <TableRow key={employee.id}>
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar name={employee.name} className="h-9 w-9 text-xs" />
                    <div>
                      <div className="font-medium text-white">{employee.name}</div>
                      <div className="text-xs text-slate-400">{roleLabels[employee.role]}</div>
                    </div>
                  </div>
                </Td>
                <Td className="text-right font-semibold text-white">{target || "0"}</Td>
                <Td className="text-right text-white">{item.receivedCustomers}</Td>
                <Td className="text-right text-white">{item.calledCustomers}</Td>
                <Td className="text-right text-white">{item.successfulCalls}</Td>
                <Td className="text-right text-white">{item.interestedCustomers}</Td>
              </TableRow>
            );
          }) : (
            <tr><Td className="py-6 text-slate-400" colSpan={6}>Chưa có nhân viên.</Td></tr>
          )}
        </TableBody>
      </GlassTable>
    </GlassCard>
  );
}

function CreateEmployeeForm({
  form,
  setForm,
  onSubmit
}: {
  form: {
    name: string;
    username: string;
    email: string;
    password: string;
    role: UserRole;
  };
  setForm: Dispatch<SetStateAction<{
    name: string;
    username: string;
    email: string;
    password: string;
    role: UserRole;
  }>>;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="glass-card p-4">
      <h2 className="mb-3 text-base font-semibold text-white">Admin tạo tài khoản nhân viên</h2>
      <Field label="Họ tên" value={form.name} onChange={(value) => setForm((old) => ({ ...old, name: value }))} />
      <Field label="Tên đăng nhập" value={form.username} onChange={(value) => setForm((old) => ({ ...old, username: value }))} />
      <Field label="Thư điện tử" type="email" value={form.email} onChange={(value) => setForm((old) => ({ ...old, email: value }))} />
      <Field label="Mật khẩu" type="password" value={form.password} onChange={(value) => setForm((old) => ({ ...old, password: value }))} />
      <label className="mb-3 block">
        <span className="mb-1 block text-sm font-medium text-slate-300">Vai trò</span>
        <div className="flex h-10 items-center rounded-lg border border-cyan-300/[0.14] bg-cyan-300/[0.06] px-3 text-sm font-semibold text-white">
          Nhân viên
        </div>
      </label>
      <NeonButton className="w-full">
        <Plus className="h-4 w-4" aria-hidden="true" />
        Tạo tài khoản nhân viên
      </NeonButton>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
  required = true
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm font-medium text-slate-300">{label}</span>
      <Input required={required} disabled={disabled} value={value} type={type} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

