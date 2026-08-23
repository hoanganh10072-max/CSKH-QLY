"use client";

import { CalendarDays, Save, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { ErrorAlert, SuccessAlert } from "@/components/alert";
import { AppShell } from "@/components/app-shell";
import { GlassCard } from "@/components/UI/GlassCard";
import { Input } from "@/components/UI/Input";
import { NeonButton } from "@/components/UI/NeonButton";
import { Select } from "@/components/UI/Select";
import { apiFetch, describeError, getStoredUser, getToken, setSession } from "@/lib/api";
import type { SessionUser } from "@/lib/types";

type DayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

type ScheduleDay = {
  working: boolean;
  start: string;
  end: string;
};

type WeeklySchedule = {
  id?: string;
  weekStart: string;
  note: string;
  days: Record<DayKey, ScheduleDay>;
  updatedAt?: string;
};

type MeTab = "profile" | "schedule";

type ProfileForm = {
  name: string;
  email: string;
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

const dayItems: Array<{ key: DayKey; label: string }> = [
  { key: "monday", label: "Thứ hai" },
  { key: "tuesday", label: "Thứ ba" },
  { key: "wednesday", label: "Thứ tư" },
  { key: "thursday", label: "Thứ năm" },
  { key: "friday", label: "Thứ sáu" },
  { key: "saturday", label: "Thứ bảy" },
  { key: "sunday", label: "Chủ nhật" }
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

const profileFromUser = (user: SessionUser): ProfileForm => ({
  name: user.name,
  email: user.email,
  phone: user.phone || "",
  employeeCode: user.employeeCode || "",
  department: user.department || "",
  positionTitle: user.positionTitle || "",
  dateOfBirth: dateInputValue(user.dateOfBirth),
  gender: user.gender || "",
  citizenId: user.citizenId || "",
  citizenIssuedDate: dateInputValue(user.citizenIssuedDate),
  citizenIssuedPlace: user.citizenIssuedPlace || "",
  currentAddress: user.currentAddress || "",
  hometown: user.hometown || "",
  emergencyContactName: user.emergencyContactName || "",
  emergencyContactPhone: user.emergencyContactPhone || "",
  startDate: dateInputValue(user.startDate),
  personalNote: user.personalNote || "",
  bankAccountNumber: user.bankAccountNumber || "",
  bankName: user.bankName || "",
  bankAccountHolder: user.bankAccountHolder || ""
});

export default function MePage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [activeTab, setActiveTab] = useState<MeTab>("profile");
  const [profile, setProfile] = useState<ProfileForm>({
    name: "",
    email: "",
    phone: "",
    employeeCode: "",
    department: "",
    positionTitle: "",
    dateOfBirth: "",
    gender: "",
    citizenId: "",
    citizenIssuedDate: "",
    citizenIssuedPlace: "",
    currentAddress: "",
    hometown: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    startDate: "",
    personalNote: "",
    bankAccountNumber: "",
    bankName: "",
    bankAccountHolder: ""
  });
  const [weekStart, setWeekStart] = useState(defaultWeekStart);
  const [schedule, setSchedule] = useState<WeeklySchedule>(() => defaultSchedule(defaultWeekStart()));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const loadProfile = async () => {
    setLoadingProfile(true);
    setError("");
    try {
      const data = await apiFetch<{ user: SessionUser }>("/auth/me");
      setUser(data.user);
      setProfile(profileFromUser(data.user));
    } catch (caught) {
      const stored = getStoredUser();
      if (stored) {
        setUser(stored);
        setProfile(profileFromUser(stored));
      }
      setError(describeError(caught, "Không tải được thông tin cá nhân"));
    } finally {
      setLoadingProfile(false);
    }
  };

  const loadSchedule = async (targetWeekStart: string) => {
    setLoadingSchedule(true);
    setError("");
    try {
      const data = await apiFetch<{ schedule: WeeklySchedule | null }>(`/auth/me/schedule?weekStart=${encodeURIComponent(targetWeekStart)}`);
      setSchedule(data.schedule || defaultSchedule(targetWeekStart));
    } catch (caught) {
      setSchedule(defaultSchedule(targetWeekStart));
      setError(describeError(caught, "Không tải được lịch làm việc"));
    } finally {
      setLoadingSchedule(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    loadSchedule(weekStart);
  }, [weekStart]);

  const updateScheduleDay = (key: DayKey, patch: Partial<ScheduleDay>) => {
    setSchedule((old) => ({
      ...old,
      days: {
        ...old.days,
        [key]: {
          ...old.days[key],
          ...patch
        }
      }
    }));
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    setError("");
    setMessage("");
    try {
      const data = await apiFetch<{ user: SessionUser }>("/auth/me", {
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
      const token = getToken();
      if (token) setSession(token, data.user);
      setUser(data.user);
      setProfile(profileFromUser(data.user));
      setMessage("Đã cập nhật thông tin cá nhân.");
    } catch (caught) {
      setError(describeError(caught, "Không thể cập nhật thông tin cá nhân"));
    } finally {
      setSavingProfile(false);
    }
  };

  const saveSchedule = async (event: FormEvent) => {
    event.preventDefault();
    setSavingSchedule(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        ...schedule,
        weekStart
      };
      const data = await apiFetch<{ schedule: WeeklySchedule }>("/auth/me/schedule", {
        method: "PUT",
        json: payload
      });
      setSchedule(data.schedule);
      setMessage("Đã lưu lịch làm việc tuần.");
    } catch (caught) {
      setError(describeError(caught, "Không thể lưu lịch làm việc"));
    } finally {
      setSavingSchedule(false);
    }
  };

  return (
    <AppShell>
      {error ? <ErrorAlert className="mb-4">{error}</ErrorAlert> : null}
      {message ? <SuccessAlert className="mb-4">{message}</SuccessAlert> : null}

      <MeSubMenu activeTab={activeTab} onChange={setActiveTab} />

      <section className="mt-5" aria-label={activeTab === "profile" ? "Thông tin cá nhân" : "Đăng kí lịch làm"}>
        {activeTab === "profile" ? (
          <ProfilePanel
            user={user}
            profile={profile}
            setProfile={setProfile}
            loading={loadingProfile}
            saving={savingProfile}
            onSubmit={saveProfile}
          />
        ) : (
          <SchedulePanel
            weekStart={weekStart}
            setWeekStart={setWeekStart}
            schedule={schedule}
            setSchedule={setSchedule}
            loading={loadingSchedule}
            saving={savingSchedule}
            onSubmit={saveSchedule}
            updateScheduleDay={updateScheduleDay}
          />
        )}
      </section>
    </AppShell>
  );
}

function MeSubMenu({
  activeTab,
  onChange
}: {
  activeTab: MeTab;
  onChange: Dispatch<SetStateAction<MeTab>>;
}) {
  const items: Array<{ key: MeTab; label: string; icon: LucideIcon }> = [
    { key: "profile", label: "Thông tin cá nhân", icon: UserRound },
    { key: "schedule", label: "Đăng kí lịch làm", icon: CalendarDays }
  ];

  return (
    <nav className="glass-card p-1" aria-label="Menu con trang Tôi">
      <div className="flex flex-col gap-1 sm:flex-row">
        {items.map((item) => {
          const active = activeTab === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => onChange(item.key)}
              className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-md border px-4 py-3 text-sm font-semibold transition focus-ring ${
                active
                  ? "border-cyan-300/[0.50] bg-cyan-300/[0.14] text-white shadow-neon"
                  : "border-transparent text-slate-300 hover:border-cyan-300/[0.22] hover:bg-white/[0.05] hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function ProfilePanel({
  user,
  profile,
  setProfile,
  loading,
  saving,
  onSubmit
}: {
  user: SessionUser | null;
  profile: ProfileForm;
  setProfile: Dispatch<SetStateAction<ProfileForm>>;
  loading: boolean;
  saving: boolean;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="glass-card p-4">
      <div className="mb-4 flex items-center gap-2 border-b border-cyan-300/10 pb-3">
        <UserRound className="h-4 w-4 text-brand" aria-hidden="true" />
        <h2 className="text-base font-semibold text-white">Thông tin cá nhân</h2>
      </div>

      {loading ? (
        <div className="py-6 text-sm text-slate-400">Đang tải...</div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-cyan-300/[0.12]">
            <ProfileSection title="Thông tin công việc">
              <Field label="Họ tên" value={profile.name} onChange={(value) => setProfile((old) => ({ ...old, name: value }))} />
              <Field label="Bộ phận" value={profile.department} onChange={(value) => setProfile((old) => ({ ...old, department: value }))} required={false} />
              <Field label="Ngày vào làm" type="date" value={profile.startDate} onChange={(value) => setProfile((old) => ({ ...old, startDate: value }))} required={false} />
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-300">Vai trò</span>
                <div className="flex h-10 items-center rounded-lg border border-cyan-300/[0.14] bg-cyan-300/[0.06] px-3 text-sm text-slate-300">
                  {user?.role === "STAFF" ? "Nhân viên" : "Quản trị viên"}
                </div>
              </label>
              <Field label="Quê quán" value={profile.hometown} onChange={(value) => setProfile((old) => ({ ...old, hometown: value }))} required={false} />
              <Field label="Nơi ở hiện tại" value={profile.currentAddress} onChange={(value) => setProfile((old) => ({ ...old, currentAddress: value }))} required={false} />
            </ProfileSection>

            <ProfileSection title="Thông tin liên hệ">
              <Field label="Thư điện tử" value={profile.email} onChange={() => undefined} disabled />
              <Field label="Số điện thoại" value={profile.phone} onChange={(value) => setProfile((old) => ({ ...old, phone: value }))} required={false} />
            </ProfileSection>

            <ProfileSection title="Giấy tờ cá nhân">
              <Field label="Ngày sinh" type="date" value={profile.dateOfBirth} onChange={(value) => setProfile((old) => ({ ...old, dateOfBirth: value }))} required={false} />
              <SelectField label="Giới tính" value={profile.gender} onChange={(value) => setProfile((old) => ({ ...old, gender: value }))} />
              <Field label="Số CCCD/CMND" value={profile.citizenId} onChange={(value) => setProfile((old) => ({ ...old, citizenId: value }))} required={false} />
              <Field label="Ngày cấp" type="date" value={profile.citizenIssuedDate} onChange={(value) => setProfile((old) => ({ ...old, citizenIssuedDate: value }))} required={false} />
              <Field label="Nơi cấp" value={profile.citizenIssuedPlace} onChange={(value) => setProfile((old) => ({ ...old, citizenIssuedPlace: value }))} required={false} />
            </ProfileSection>

            <ProfileSection title="Thông tin ngân hàng">
              <Field label="Số tài khoản" value={profile.bankAccountNumber} onChange={(value) => setProfile((old) => ({ ...old, bankAccountNumber: value }))} required={false} />
              <Field label="Tên ngân hàng" value={profile.bankName} onChange={(value) => setProfile((old) => ({ ...old, bankName: value }))} required={false} />
              <Field label="Tên chủ tài khoản" value={profile.bankAccountHolder} onChange={(value) => setProfile((old) => ({ ...old, bankAccountHolder: value }))} required={false} />
            </ProfileSection>

          </div>

          <div className="mt-4 flex justify-end">
            <NeonButton type="submit" disabled={saving} className="w-full sm:w-72">
              <Save className="h-4 w-4" aria-hidden="true" />
              {saving ? "Đang lưu..." : "Lưu thông tin"}
            </NeonButton>
          </div>
        </>
      )}
    </form>
  );
}

function ProfileSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-cyan-300/[0.10] p-4 last:border-b-0 lg:grid-cols-[220px_minmax(0,1fr)]">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-cyan-100">{title}</h3>
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
}

function SchedulePanel({
  weekStart,
  setWeekStart,
  schedule,
  setSchedule,
  loading,
  saving,
  onSubmit,
  updateScheduleDay
}: {
  weekStart: string;
  setWeekStart: (value: string) => void;
  schedule: WeeklySchedule;
  setSchedule: Dispatch<SetStateAction<WeeklySchedule>>;
  loading: boolean;
  saving: boolean;
  onSubmit: (event: FormEvent) => void;
  updateScheduleDay: (key: DayKey, patch: Partial<ScheduleDay>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="glass-card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-cyan-300/10 pb-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-brand" aria-hidden="true" />
          <h2 className="text-base font-semibold text-white">Đăng kí lịch làm</h2>
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
        <div className="py-6 text-sm text-slate-400">Đang tải lịch làm việc...</div>
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
                      <Input
                        type="time"
                        value={day.start}
                        disabled={!day.working}
                        onChange={(event) => updateScheduleDay(item.key, { start: event.target.value })}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-slate-400">Kết thúc</span>
                      <Input
                        type="time"
                        value={day.end}
                        disabled={!day.working}
                        onChange={(event) => updateScheduleDay(item.key, { end: event.target.value })}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-medium text-slate-300">Ghi chú</span>
            <textarea
              value={schedule.note}
              onChange={(event) => setSchedule((old) => ({ ...old, note: event.target.value }))}
              rows={3}
              className="neon-field min-h-24 w-full px-3 py-2"
              placeholder="Ví dụ: ca làm linh hoạt, nghỉ phép, đổi ca..."
            />
          </label>

          <NeonButton type="submit" disabled={saving} className="mt-4">
            <Save className="h-4 w-4" aria-hidden="true" />
            {saving ? "Đang lưu..." : "Lưu lịch tuần"}
          </NeonButton>
        </>
      )}
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
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-300">{label}</span>
      <Input required={required} disabled={disabled} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-300">{label}</span>
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Chưa chọn</option>
        <option value="Nam">Nam</option>
        <option value="Nữ">Nữ</option>
        <option value="Khác">Khác</option>
      </Select>
    </label>
  );
}
