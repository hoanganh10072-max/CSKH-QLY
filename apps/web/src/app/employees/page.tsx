"use client";

import { ArrowRightLeft, CalendarDays, CircleDollarSign, ClipboardList, Download, Eye, FileText, GraduationCap, Headphones, MessageSquareText, PhoneCall, Plus, Save, ShieldCheck, Trash2, UserRound, Users, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { apiFetch, describeError, getApiBaseUrl, getStoredUser, getToken } from "@/lib/api";
import { notifyDataChanged } from "@/lib/live-sync";
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

type InternDailyReport = {
  id?: string;
  workDate: string;
  workSummary: string;
  result: string;
  challenges: string;
  planForNextDay: string;
  createdAt?: string;
  updatedAt?: string;
};

type InternCv = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  updatedAt: string;
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

type ManagedEmployeeRole = "STAFF" | "INTERN";

type EmployeeProfileForm = {
  name: string;
  phone: string;
  employeeCode: string;
  department: string;
  positionTitle: string;
  dateOfBirth: string;
  gender: string;
  citizenId: string;
  citizenIssuedDate: string;
  citizenIssuedPlace: string;
  currentAddress: string;
  hometown: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  startDate: string;
  personalNote: string;
  bankAccountNumber: string;
  bankName: string;
  bankAccountHolder: string;
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

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

const emptyInternReport = (workDate: string): InternDailyReport => ({
  workDate,
  workSummary: "",
  result: "",
  challenges: "",
  planForNextDay: ""
});

const defaultSchedule = (weekStart: string): WeeklySchedule => ({
  weekStart,
  note: "",
  days: {
    monday: { working: true, start: "08:00", end: "17:00" },
    tuesday: { working: true, start: "08:00", end: "17:00" },
    wednesday: { working: true, start: "08:00", end: "17:00" },
    thursday: { working: true, start: "08:00", end: "17:00" },
    friday: { working: true, start: "08:00", end: "17:00" },
    saturday: { working: false, start: "", end: "" },
    sunday: { working: false, start: "", end: "" }
  }
});

const dateInputValue = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return localDate(date);
};

const profileFromEmployee = (employee: Employee): EmployeeProfileForm => ({
  name: employee.name,
  phone: employee.phone || "",
  employeeCode: employee.employeeCode || "",
  department: employee.department || "",
  positionTitle: employee.positionTitle || "",
  dateOfBirth: dateInputValue(employee.dateOfBirth),
  gender: employee.gender || "",
  citizenId: employee.citizenId || "",
  citizenIssuedDate: dateInputValue(employee.citizenIssuedDate),
  citizenIssuedPlace: employee.citizenIssuedPlace || "",
  currentAddress: employee.currentAddress || "",
  hometown: employee.hometown || "",
  emergencyContactName: employee.emergencyContactName || "",
  emergencyContactPhone: employee.emergencyContactPhone || "",
  startDate: dateInputValue(employee.startDate),
  personalNote: employee.personalNote || "",
  bankAccountNumber: employee.bankAccountNumber || "",
  bankName: employee.bankName || "",
  bankAccountHolder: employee.bankAccountHolder || ""
});

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
  const pathname = usePathname();
  const managedRole: ManagedEmployeeRole = pathname.endsWith("/interns") ? "INTERN" : "STAFF";
  const managedRoleLabel = roleLabels[managedRole].toLowerCase();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingWeeklySchedules, setLoadingWeeklySchedules] = useState(false);
  const [loadingDailyKpis, setLoadingDailyKpis] = useState(false);
  const [savingKpiTarget, setSavingKpiTarget] = useState(false);
  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [switchingId, setSwitchingId] = useState("");
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
  const scheduleLoadKeyRef = useRef("");
  const kpiLoadKeyRef = useRef("");

  const viewedEmployee = useMemo(
    () => employees.find((employee) => employee.id === viewEmployeeId) || null,
    [employees, viewEmployeeId]
  );

  const employeeIdsKey = useMemo(
    () => employees.map((employee) => employee.id).sort().join("|"),
    [employees]
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

  const internTotals = useMemo(() => ({
    employees: employees.length,
    activeEmployees: employees.filter((employee) => employee.status === "ACTIVE").length,
    scheduledEmployees: employees.filter((employee) => Boolean(weeklySchedules[employee.id])).length
  }), [employees, weeklySchedules]);

  const load = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    if (!silent) setError("");
    try {
      const data = await apiFetch<{ users: Employee[] }>(`/users?role=${managedRole}`);
      const staffUsers = data.users.filter((item) => item.role === managedRole);
      const optimisticEmployees = Object.values(optimisticEmployeesRef.current).filter(
        (item) => item.role === managedRole
      );
      const mergedUsers = [
        ...optimisticEmployees.filter((employee) => !staffUsers.some((item) => item.id === employee.id)),
        ...staffUsers
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
      setEmployees([]);
      setSelectedId("");
      setViewEmployeeId("");
      scheduleLoadKeyRef.current = "";
      void load();
    } else {
      setLoading(false);
    }
  }, [managedRole]);

  useEffect(() => {
    if (user?.role !== "ADMIN") {
      scheduleLoadKeyRef.current = "";
      setWeeklySchedules({});
      return;
    }

    if (!employees.length) {
      scheduleLoadKeyRef.current = "";
      setWeeklySchedules({});
      return;
    }

    const loadKey = `${weekStart}:${employeeIdsKey}`;
    if (scheduleLoadKeyRef.current === loadKey) return;
    scheduleLoadKeyRef.current = loadKey;
    void loadWeeklySchedules(weekStart);
  }, [user?.role, weekStart, employeeIdsKey, employees.length]);

  useEffect(() => {
    if (user?.role !== "ADMIN" || managedRole !== "STAFF") {
      kpiLoadKeyRef.current = "";
      setDailyKpis({});
      return;
    }

    if (!kpiPeriod) return;

    const loadKey = `${kpiMode}:${kpiPeriod}`;
    if (kpiLoadKeyRef.current === loadKey) return;
    kpiLoadKeyRef.current = loadKey;
    void loadDailyKpis(kpiMode, kpiPeriod);
  }, [user?.role, managedRole, kpiMode, kpiPeriod]);

  const createEmployee = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setCreatingEmployee(true);
    try {
      const data = await apiFetch<{ user: Employee }>("/users", {
        method: "POST",
        json: createForm
      });
      const createdEmployee: Employee = {
        ...data.user,
        revenue: Number(data.user.revenue || 0),
        _count: data.user._count || {
          ownedCustomers: 0,
          interactions: 0,
          tasks: 0
        }
      };

      if (createdEmployee.role === managedRole) {
        optimisticEmployeesRef.current = {
          ...optimisticEmployeesRef.current,
          [createdEmployee.id]: createdEmployee
        };
        setEmployees((current) => [
          createdEmployee,
          ...current.filter((employee) => employee.id !== createdEmployee.id)
        ]);
      }
      setLoading(false);
      if (createdEmployee.role === managedRole) setSelectedId(createdEmployee.id);
      setCreateForm({ name: "", username: "", email: "", password: "1", role: "STAFF" });
      setMessage(`Đã tạo tài khoản ${roleLabels[createdEmployee.role].toLowerCase()}.`);
      notifyDataChanged({ area: "users", source: "create-employee" });
      await load({ silent: true });
      if (createdEmployee.role === managedRole) await loadWeeklySchedules(weekStart, { silent: true });
      if (createdEmployee.role === "STAFF" && managedRole === "STAFF" && kpiPeriod) {
        await loadDailyKpis(kpiMode, kpiPeriod, { silent: true });
      }
    } catch (caught) {
      setError(describeError(caught, "Không thể tạo nhân viên"));
    } finally {
      setCreatingEmployee(false);
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

  const updateEmployeeInList = (updatedEmployee: Employee) => {
    setEmployees((current) => current.map((employee) => (
      employee.id === updatedEmployee.id
        ? { ...employee, ...updatedEmployee, _count: employee._count, revenue: employee.revenue }
        : employee
    )));
  };

  const updateEmployeeSchedule = (employeeId: string, schedule: WeeklySchedule) => {
    setWeeklySchedules((current) => ({ ...current, [employeeId]: { ...schedule, userId: employeeId } }));
  };

  const switchEmployeeRole = async (employee: Employee) => {
    const nextRole: ManagedEmployeeRole = employee.role === "STAFF" ? "INTERN" : "STAFF";
    setSwitchingId(employee.id);
    setError("");
    setMessage("");

    try {
      await apiFetch(`/users/${employee.id}`, {
        method: "PATCH",
        json: { role: nextRole }
      });

      const nextOptimisticEmployees = { ...optimisticEmployeesRef.current };
      delete nextOptimisticEmployees[employee.id];
      optimisticEmployeesRef.current = nextOptimisticEmployees;
      const nextEmployees = employees.filter((item) => item.id !== employee.id);
      setEmployees(nextEmployees);
      if (selectedId === employee.id) setSelectedId(nextEmployees[0]?.id || "");
      if (viewEmployeeId === employee.id) setViewEmployeeId("");
      setMessage(`Đã chuyển ${employee.name} sang nhóm ${roleLabels[nextRole].toLowerCase()}.`);
      notifyDataChanged({ area: "users", source: "change-employee-role" });
    } catch (caught) {
      setError(describeError(caught, "Không thể chuyển nhóm nhân viên"));
    } finally {
      setSwitchingId("");
    }
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
      <PageHeading
        title="Quản lý nhân viên"
        subtitle={`Đang theo dõi nhóm ${managedRoleLabel}: tài khoản, hồ sơ và kết quả làm việc.`}
      />

      {!user ? (
        <div className="glass-card p-4 text-sm text-slate-400">Đang tải quyền truy cập...</div>
      ) : user.role !== "ADMIN" ? (
        <WarningAlert>Chỉ quản trị viên được quản lý nhân viên.</WarningAlert>
      ) : (
        <div className="space-y-5">
          <EmployeeRoleTabs currentRole={managedRole} />

          {managedRole === "INTERN" ? (
            <section className="grid gap-4 md:grid-cols-3">
              <MetricCard label="Tổng nhân viên thực tập" value={String(internTotals.employees)} icon={GraduationCap} tone="cyan" />
              <MetricCard label="Tài khoản hoạt động" value={String(internTotals.activeEmployees)} icon={ShieldCheck} tone="violet" />
              <MetricCard label="Đã có lịch trong tuần" value={String(internTotals.scheduledEmployees)} icon={CalendarDays} tone="emerald" />
            </section>
          ) : (
            <section className="grid gap-4 md:grid-cols-3">
              <MetricCard label="Khách hàng đang chăm sóc" value={String(totals.activeCustomers)} icon={PhoneCall} tone="cyan" />
              <MetricCard label="Tư vấn khách hàng" value={String(totals.consultations)} icon={MessageSquareText} tone="violet" />
              <MetricCard label="Doanh thu nhân viên" value={currencyFormat.format(totals.revenue)} icon={CircleDollarSign} tone="emerald" />
            </section>
          )}

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
            onManageEmployee={setViewEmployeeId}
            managedRole={managedRole}
          />

          <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_400px]">
            <div className="space-y-5">
              <GlassCard>
                <div className="flex items-center gap-2 border-b border-cyan-300/10 px-4 py-3">
                  <Users className="h-4 w-4 text-brand" aria-hidden="true" />
                  <h2 className="text-base font-semibold text-white">
                    {managedRole === "INTERN" ? "Hồ sơ và tài khoản nhân viên thực tập" : "Quản lý tài khoản nhân viên CSKH"}
                  </h2>
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
                              {managedRole === "INTERN" ? "Quản lý hồ sơ, lịch & báo cáo" : "Xem thông tin nhân viên"}
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
                            <button
                              type="button"
                              onClick={() => switchEmployeeRole(employee)}
                              disabled={switchingId === employee.id}
                              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-violet-300/[0.35] bg-violet-500/[0.10] px-3 py-2 text-sm font-semibold leading-tight text-violet-50 transition hover:bg-violet-500/[0.16] disabled:cursor-not-allowed disabled:opacity-50 focus-ring"
                            >
                              <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
                              {switchingId === employee.id
                                ? "Đang chuyển..."
                                : `Chuyển sang ${employee.role === "STAFF" ? "thực tập" : "CSKH"}`}
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

              {managedRole === "STAFF" ? (
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
              ) : null}
            </div>

            <div className="space-y-5">
              <CreateEmployeeForm
                form={createForm}
                setForm={setCreateForm}
                onSubmit={createEmployee}
                creating={creatingEmployee}
              />
            </div>
          </div>

          {viewedEmployee ? managedRole === "INTERN" ? (
            <InternEmployeeManagerDialog
              employee={viewedEmployee}
              initialWeekStart={weekStart}
              onEmployeeUpdated={updateEmployeeInList}
              onScheduleUpdated={updateEmployeeSchedule}
              onClose={() => setViewEmployeeId("")}
            />
          ) : (
            <EmployeeInfoDialog employee={viewedEmployee} onClose={() => setViewEmployeeId("")} />
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

function EmployeeRoleTabs({ currentRole }: { currentRole: ManagedEmployeeRole }) {
  const items: Array<{ role: ManagedEmployeeRole; href: string; label: string; description: string; icon: LucideIcon }> = [
    {
      role: "STAFF",
      href: "/employees/customer-care",
      label: "Nhân viên CSKH",
      description: "Theo dõi khách hàng và KPI theo hệ thống cũ",
      icon: Headphones
    },
    {
      role: "INTERN",
      href: "/employees/interns",
      label: "Nhân viên thực tập",
      description: "Hồ sơ, lịch tuần và báo cáo công việc ngày",
      icon: GraduationCap
    }
  ];

  return (
    <nav className="grid gap-3 sm:grid-cols-2" aria-label="Nhóm nhân viên">
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.role === currentRole;

        return (
          <Link
            key={item.role}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition focus-ring ${
              active
                ? "border-cyan-300/[0.45] bg-cyan-300/[0.12] text-white shadow-neon"
                : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-300/[0.25] hover:bg-white/[0.07]"
            }`}
          >
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border ${active ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100" : "border-white/10 bg-white/[0.04] text-slate-400"}`}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-semibold">{item.label}</span>
              <span className="mt-0.5 block text-xs text-slate-400">{item.description}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function InternEmployeeManagerDialog({
  employee,
  initialWeekStart,
  onEmployeeUpdated,
  onScheduleUpdated,
  onClose
}: {
  employee: Employee;
  initialWeekStart: string;
  onEmployeeUpdated: (employee: Employee) => void;
  onScheduleUpdated: (employeeId: string, schedule: WeeklySchedule) => void;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"profile" | "schedule" | "report">("profile");
  const [profile, setProfile] = useState<EmployeeProfileForm>(() => profileFromEmployee(employee));
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [schedule, setSchedule] = useState<WeeklySchedule>(() => defaultSchedule(initialWeekStart));
  const [reportDate, setReportDate] = useState(() => localDate(new Date()));
  const [report, setReport] = useState<InternDailyReport>(() => emptyInternReport(localDate(new Date())));
  const [cv, setCv] = useState<InternCv | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [loadingCv, setLoadingCv] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setProfile(profileFromEmployee(employee));
  }, [employee]);

  useEffect(() => {
    let active = true;
    setLoadingSchedule(true);
    setError("");

    apiFetch<{ schedule: WeeklySchedule | null }>(
      `/users/${employee.id}/schedule?weekStart=${encodeURIComponent(weekStart)}`
    )
      .then((data) => {
        if (active) setSchedule(data.schedule || defaultSchedule(weekStart));
      })
      .catch((caught) => {
        if (!active) return;
        setSchedule(defaultSchedule(weekStart));
        setError(describeError(caught, "Không tải được lịch làm việc của nhân viên"));
      })
      .finally(() => {
        if (active) setLoadingSchedule(false);
      });

    return () => {
      active = false;
    };
  }, [employee.id, weekStart]);

  useEffect(() => {
    let active = true;
    setLoadingReport(true);
    setError("");

    apiFetch<{ report: InternDailyReport | null }>(
      `/users/${employee.id}/daily-report?workDate=${encodeURIComponent(reportDate)}`
    )
      .then((data) => {
        if (active) setReport(data.report || emptyInternReport(reportDate));
      })
      .catch((caught) => {
        if (!active) return;
        setReport(emptyInternReport(reportDate));
        setError(describeError(caught, "Không tải được báo cáo công việc của nhân viên"));
      })
      .finally(() => {
        if (active) setLoadingReport(false);
      });

    return () => {
      active = false;
    };
  }, [employee.id, reportDate]);

  useEffect(() => {
    let active = true;
    setLoadingCv(true);
    apiFetch<{ cv: InternCv | null }>(`/users/${employee.id}/cv`)
      .then((data) => {
        if (active) setCv(data.cv);
      })
      .catch((caught) => {
        if (active) setError(describeError(caught, "Không tải được CV của nhân viên"));
      })
      .finally(() => {
        if (active) setLoadingCv(false);
      });
    return () => {
      active = false;
    };
  }, [employee.id]);

  const downloadCv = async () => {
    if (!cv) return;
    setError("");
    try {
      const response = await fetch(`${getApiBaseUrl()}/users/${employee.id}/cv/download`, {
        headers: { Authorization: `Bearer ${getToken() || ""}` }
      });
      if (!response.ok) throw new Error("Không thể tải CV xuống");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = cv.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(describeError(caught, "Không thể tải CV xuống"));
    }
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    setError("");
    setMessage("");

    try {
      const data = await apiFetch<{ user: Employee }>(`/users/${employee.id}`, {
        method: "PATCH",
        json: {
          name: profile.name,
          phone: profile.phone || null,
          employeeCode: profile.employeeCode || null,
          department: profile.department || null,
          positionTitle: profile.positionTitle || null,
          dateOfBirth: profile.dateOfBirth || null,
          gender: profile.gender || null,
          citizenId: profile.citizenId || null,
          citizenIssuedDate: profile.citizenIssuedDate || null,
          citizenIssuedPlace: profile.citizenIssuedPlace || null,
          currentAddress: profile.currentAddress || null,
          hometown: profile.hometown || null,
          emergencyContactName: profile.emergencyContactName || null,
          emergencyContactPhone: profile.emergencyContactPhone || null,
          startDate: profile.startDate || null,
          personalNote: profile.personalNote || null,
          bankAccountNumber: profile.bankAccountNumber || null,
          bankName: profile.bankName || null,
          bankAccountHolder: profile.bankAccountHolder || null
        }
      });
      const updatedEmployee = { ...employee, ...data.user };
      setProfile(profileFromEmployee(updatedEmployee));
      onEmployeeUpdated(updatedEmployee);
      setMessage("Đã lưu hồ sơ nhân viên.");
      notifyDataChanged({ area: "users", source: "update-intern-profile" });
    } catch (caught) {
      setError(describeError(caught, "Không thể lưu hồ sơ nhân viên"));
    } finally {
      setSavingProfile(false);
    }
  };

  const updateScheduleDay = (key: DayKey, patch: Partial<ScheduleDay>) => {
    setSchedule((current) => ({
      ...current,
      days: {
        ...current.days,
        [key]: { ...current.days[key], ...patch }
      }
    }));
  };

  const saveSchedule = async (event: FormEvent) => {
    event.preventDefault();
    setSavingSchedule(true);
    setError("");
    setMessage("");

    try {
      const data = await apiFetch<{ schedule: WeeklySchedule }>(`/users/${employee.id}/schedule`, {
        method: "PUT",
        json: { ...schedule, weekStart }
      });
      setSchedule(data.schedule);
      onScheduleUpdated(employee.id, data.schedule);
      setMessage("Đã lưu lịch làm việc của nhân viên.");
      notifyDataChanged({ area: "users", source: "update-intern-schedule" });
    } catch (caught) {
      setError(describeError(caught, "Không thể lưu lịch làm việc của nhân viên"));
    } finally {
      setSavingSchedule(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 px-3 py-4 backdrop-blur-sm">
      <div className="glass-card flex max-h-[calc(100vh-32px)] w-full max-w-6xl flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-cyan-300/10 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={employee.name} />
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-white">Quản lý nhân viên thực tập</h2>
              <p className="truncate text-sm text-slate-400">{employee.name} · {employee.username || employee.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-cyan-300/[0.20] bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08] focus-ring"
            aria-label="Đóng trình quản lý nhân viên"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-3 border-b border-cyan-300/10 bg-slate-950/35 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition focus-ring ${activeTab === "profile" ? "border-cyan-300/[0.40] bg-cyan-300/[0.12] text-white" : "border-transparent text-slate-400 hover:bg-white/[0.05] hover:text-white"}`}
          >
            <UserRound className="h-4 w-4" aria-hidden="true" />
            Hồ sơ nhân viên
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("schedule")}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition focus-ring ${activeTab === "schedule" ? "border-cyan-300/[0.40] bg-cyan-300/[0.12] text-white" : "border-transparent text-slate-400 hover:bg-white/[0.05] hover:text-white"}`}
          >
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            Lịch làm việc
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("report")}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition focus-ring ${activeTab === "report" ? "border-cyan-300/[0.40] bg-cyan-300/[0.12] text-white" : "border-transparent text-slate-400 hover:bg-white/[0.05] hover:text-white"}`}
          >
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            Báo cáo trong ngày
          </button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-5">
          {error ? <ErrorAlert className="mb-4">{error}</ErrorAlert> : null}
          {message ? <SuccessAlert className="mb-4">{message}</SuccessAlert> : null}

          {activeTab === "profile" ? (
            <form onSubmit={saveProfile}>
              <div className="grid gap-x-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Họ tên" value={profile.name} onChange={(value) => setProfile((old) => ({ ...old, name: value }))} />
                <Field label="Tên đăng nhập" value={employee.username || ""} onChange={() => undefined} disabled />
                <Field label="Thư điện tử" type="email" value={employee.email} onChange={() => undefined} disabled />
                <Field label="Mã nhân viên" value={profile.employeeCode} onChange={(value) => setProfile((old) => ({ ...old, employeeCode: value }))} required={false} />
                <Field label="Bộ phận" value={profile.department} onChange={(value) => setProfile((old) => ({ ...old, department: value }))} required={false} />
                <Field label="Chức danh" value={profile.positionTitle} onChange={(value) => setProfile((old) => ({ ...old, positionTitle: value }))} required={false} />
                <Field label="Ngày vào làm" type="date" value={profile.startDate} onChange={(value) => setProfile((old) => ({ ...old, startDate: value }))} required={false} />
                <Field label="Số điện thoại" value={profile.phone} onChange={(value) => setProfile((old) => ({ ...old, phone: value }))} required={false} />
                <Field label="Ngày sinh" type="date" value={profile.dateOfBirth} onChange={(value) => setProfile((old) => ({ ...old, dateOfBirth: value }))} required={false} />
                <label className="mb-3 block">
                  <span className="mb-1 block text-sm font-medium text-slate-300">Giới tính</span>
                  <Select value={profile.gender} onChange={(event) => setProfile((old) => ({ ...old, gender: event.target.value }))}>
                    <option value="">Chưa chọn</option>
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </Select>
                </label>
                <Field label="Số CCCD/CMND" value={profile.citizenId} onChange={(value) => setProfile((old) => ({ ...old, citizenId: value }))} required={false} />
                <Field label="Ngày cấp" type="date" value={profile.citizenIssuedDate} onChange={(value) => setProfile((old) => ({ ...old, citizenIssuedDate: value }))} required={false} />
                <Field label="Nơi cấp" value={profile.citizenIssuedPlace} onChange={(value) => setProfile((old) => ({ ...old, citizenIssuedPlace: value }))} required={false} />
                <Field label="Quê quán" value={profile.hometown} onChange={(value) => setProfile((old) => ({ ...old, hometown: value }))} required={false} />
                <Field label="Nơi ở hiện tại" value={profile.currentAddress} onChange={(value) => setProfile((old) => ({ ...old, currentAddress: value }))} required={false} />
                <Field label="Người liên hệ khẩn cấp" value={profile.emergencyContactName} onChange={(value) => setProfile((old) => ({ ...old, emergencyContactName: value }))} required={false} />
                <Field label="SĐT liên hệ khẩn cấp" value={profile.emergencyContactPhone} onChange={(value) => setProfile((old) => ({ ...old, emergencyContactPhone: value }))} required={false} />
                <Field label="Số tài khoản" value={profile.bankAccountNumber} onChange={(value) => setProfile((old) => ({ ...old, bankAccountNumber: value }))} required={false} />
                <Field label="Tên ngân hàng" value={profile.bankName} onChange={(value) => setProfile((old) => ({ ...old, bankName: value }))} required={false} />
                <Field label="Tên chủ tài khoản" value={profile.bankAccountHolder} onChange={(value) => setProfile((old) => ({ ...old, bankAccountHolder: value }))} required={false} />
              </div>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-300">Ghi chú hồ sơ</span>
                <textarea
                  value={profile.personalNote}
                  onChange={(event) => setProfile((old) => ({ ...old, personalNote: event.target.value }))}
                  rows={3}
                  className="neon-field min-h-24 w-full px-3 py-2"
                />
              </label>
              <div className="mt-4 rounded-lg border border-cyan-300/[0.14] bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-cyan-100" aria-hidden="true" />
                    <div>
                      <div className="text-sm font-semibold text-white">CV nhân viên</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {loadingCv ? "Đang tải..." : cv ? `${cv.fileName} · ${formatFileSize(cv.fileSize)}` : "Nhân viên chưa tải CV lên"}
                      </div>
                    </div>
                  </div>
                  {cv ? (
                    <NeonButton type="button" variant="secondary" onClick={downloadCv}>
                      <Download className="h-4 w-4" aria-hidden="true" />
                      Tải CV
                    </NeonButton>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <NeonButton type="submit" disabled={savingProfile} className="w-full sm:w-auto">
                  <Save className="h-4 w-4" aria-hidden="true" />
                  {savingProfile ? "Đang lưu hồ sơ..." : "Lưu hồ sơ nhân viên"}
                </NeonButton>
              </div>
            </form>
          ) : activeTab === "schedule" ? (
            <form onSubmit={saveSchedule}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-white">Lịch làm việc theo tuần</h3>
                  <p className="mt-1 text-xs text-slate-400">Chọn ngày làm và giờ bắt đầu, kết thúc cho từng ngày.</p>
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

              {loadingSchedule ? (
                <div className="py-8 text-center text-sm text-slate-400">Đang tải lịch làm việc...</div>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {dayItems.map((item) => {
                      const day = schedule.days[item.key];
                      return (
                        <div key={item.key} className="rounded-lg border border-cyan-300/[0.12] bg-white/[0.04] p-3">
                          <label className="mb-3 flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-white">{item.label}</span>
                            <input
                              type="checkbox"
                              checked={day.working}
                              onChange={(event) => {
                                const working = event.target.checked;
                                updateScheduleDay(item.key, {
                                  working,
                                  start: working ? day.start || "08:00" : "",
                                  end: working ? day.end || "17:00" : ""
                                });
                              }}
                              className="h-4 w-4 accent-cyan-300"
                            />
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block">
                              <span className="mb-1 block text-xs text-slate-400">Bắt đầu</span>
                              <Input type="time" value={day.start} disabled={!day.working} onChange={(event) => updateScheduleDay(item.key, { start: event.target.value })} />
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-xs text-slate-400">Kết thúc</span>
                              <Input type="time" value={day.end} disabled={!day.working} onChange={(event) => updateScheduleDay(item.key, { end: event.target.value })} />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <label className="mt-4 block">
                    <span className="mb-1 block text-sm font-medium text-slate-300">Ghi chú lịch làm</span>
                    <textarea
                      value={schedule.note}
                      onChange={(event) => setSchedule((old) => ({ ...old, note: event.target.value }))}
                      rows={3}
                      className="neon-field min-h-24 w-full px-3 py-2"
                      placeholder="Ví dụ: nghỉ phép, đổi ca, lịch linh hoạt..."
                    />
                  </label>
                  <div className="mt-4 flex justify-end">
                    <NeonButton type="submit" disabled={savingSchedule} className="w-full sm:w-auto">
                      <Save className="h-4 w-4" aria-hidden="true" />
                      {savingSchedule ? "Đang lưu lịch..." : "Lưu lịch làm việc"}
                    </NeonButton>
                  </div>
                </>
              )}
            </form>
          ) : (
            <section>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-white">Báo cáo kết quả làm việc trong ngày</h3>
                  <p className="mt-1 text-xs text-slate-400">Báo cáo do nhân viên thực tập tự cập nhật.</p>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <span>Ngày báo cáo</span>
                  <Input type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} className="w-40" />
                </label>
              </div>

              {loadingReport ? (
                <div className="py-8 text-center text-sm text-slate-400">Đang tải báo cáo...</div>
              ) : report.id ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <ReportView label="Công việc đã thực hiện" value={report.workSummary} />
                  <ReportView label="Kết quả công việc" value={report.result} />
                  <ReportView label="Khó khăn / vấn đề cần hỗ trợ" value={report.challenges || "Không có"} />
                  <ReportView label="Kế hoạch ngày tiếp theo" value={report.planForNextDay || "Chưa cập nhật"} />
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-cyan-300/[0.20] bg-white/[0.03] px-4 py-10 text-center text-sm text-slate-400">
                  Nhân viên chưa gửi báo cáo cho ngày này.
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportView({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-cyan-300/[0.12] bg-white/[0.04] p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-cyan-100">{label}</h4>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">{value}</p>
    </div>
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
  onSelectEmployee,
  onManageEmployee,
  managedRole
}: {
  employees: Employee[];
  schedules: Record<string, WeeklySchedule>;
  weekStart: string;
  setWeekStart: (value: string) => void;
  loading: boolean;
  selectedId: string;
  onSelectEmployee: (id: string) => void;
  onManageEmployee: (id: string) => void;
  managedRole: ManagedEmployeeRole;
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
      workingEmployees: workingEmployees.filter((item) => isWorkingInShift(item.day, shift))
    }));

    return {
      ...item,
      date,
      workingEmployees,
      shifts
    };
  });

  return (
    <GlassCard className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-300/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-brand" aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold text-white">Bảng lịch làm việc tuần</h2>
            <p className="mt-0.5 text-xs text-slate-400">Mỗi hàng là một ngày, chia rõ ca sáng và ca chiều.</p>
          </div>
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead className="bg-slate-950/55">
              <tr className="border-b border-cyan-300/10 text-xs font-bold uppercase text-slate-400">
                <th className="w-44 px-4 py-3">Ngày</th>
                <th className="px-4 py-3">Ca sáng</th>
                <th className="px-4 py-3">Ca chiều</th>
                <th className="w-28 px-4 py-3 text-right">Tổng</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day.key} className="border-b border-cyan-300/10 last:border-b-0">
                  <td className="align-top bg-slate-900/35 px-4 py-4">
                    <div className="text-sm font-bold uppercase text-cyan-100">{day.label}</div>
                    <div className="mt-1 text-2xl font-semibold text-white">{compactDateFormat.format(day.date)}</div>
                    <div className="mt-2 inline-flex rounded-full border border-cyan-300/[0.24] bg-cyan-300/[0.10] px-2.5 py-1 text-xs font-semibold text-cyan-100">
                      {day.workingEmployees.length} người
                    </div>
                  </td>
                  {day.shifts.map((shift) => (
                    <td key={`${day.key}-${shift.key}`} className="align-top px-4 py-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="text-xs font-bold uppercase text-white">{shift.label}</div>
                        <div className="rounded-full border border-cyan-300/[0.20] bg-cyan-300/[0.08] px-2 py-0.5 text-[11px] font-semibold text-cyan-100">
                          {shift.workingEmployees.length} người
                        </div>
                      </div>
                      {shift.workingEmployees.length ? (
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {shift.workingEmployees.map(({ employee, day: scheduleDay, note }) => (
                            <button
                              key={`${day.key}-${shift.key}-${employee.id}`}
                              type="button"
                              onClick={() => {
                                onSelectEmployee(employee.id);
                                onManageEmployee(employee.id);
                              }}
                              className={`rounded-lg border px-3 py-2 text-left hover:border-cyan-300/45 hover:bg-cyan-300/[0.10] focus-ring ${
                                selectedId === employee.id
                                  ? "border-cyan-300/[0.45] bg-cyan-300/[0.12]"
                                  : "border-emerald-300/[0.20] bg-emerald-300/[0.07]"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Avatar name={employee.name} className="h-8 w-8 text-[10px]" />
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-white">{employee.name}</div>
                                  <div className="truncate text-xs text-slate-400">{roleLabels[employee.role]}</div>
                                </div>
                              </div>
                              <div className="mt-2 rounded-md border border-emerald-300/[0.18] bg-emerald-300/[0.10] px-2 py-1.5 text-center text-sm font-semibold text-emerald-100">
                                {formatShiftTime(scheduleDay, shift)}
                              </div>
                              {note ? <div className="mt-1 line-clamp-2 text-xs leading-4 text-slate-400">{note}</div> : null}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="grid min-h-20 place-items-center rounded-lg border border-slate-500/20 bg-slate-500/[0.06] px-3 text-center text-sm font-medium text-slate-500">
                          {shift.emptyLabel}
                        </div>
                      )}
                    </td>
                  ))}
                  <td className="align-top px-4 py-4 text-right">
                    <div className="text-2xl font-semibold text-white">{day.workingEmployees.length}</div>
                    <div className="text-xs text-slate-400">nhân viên</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-4 py-8 text-center">
          <div className="text-sm font-semibold text-slate-200">
            Chưa có {roleLabels[managedRole].toLowerCase()} để hiển thị lịch làm việc.
          </div>
          <div className="mt-1 text-xs text-slate-400">Tạo tài khoản cho nhóm này ở biểu mẫu bên dưới để bắt đầu xếp lịch.</div>
        </div>
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
  onSubmit,
  creating
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
  creating: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="glass-card p-4">
      <h2 className="mb-4 text-base font-semibold text-white">Tạo tài khoản chung</h2>
      <Field label="Họ tên" value={form.name} onChange={(value) => setForm((old) => ({ ...old, name: value }))} />
      <Field label="Tên đăng nhập" value={form.username} onChange={(value) => setForm((old) => ({ ...old, username: value }))} />
      <Field label="Thư điện tử" type="email" value={form.email} onChange={(value) => setForm((old) => ({ ...old, email: value }))} />
      <Field label="Mật khẩu" type="password" value={form.password} onChange={(value) => setForm((old) => ({ ...old, password: value }))} />
      <label className="mb-3 block">
        <span className="mb-1 block text-sm font-medium text-slate-300">Vai trò</span>
        <Select value={form.role} onChange={(event) => setForm((old) => ({ ...old, role: event.target.value as UserRole }))}>
          <option value="ADMIN">Quản trị viên</option>
          <option value="STAFF">Nhân viên CSKH</option>
          <option value="INTERN">Nhân viên thực tập</option>
        </Select>
      </label>
      <NeonButton type="submit" disabled={creating} className="w-full">
        <Plus className="h-4 w-4" aria-hidden="true" />
        {creating ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
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

