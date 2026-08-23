"use client";

import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  ImagePlus,
  MapPin,
  MessageSquareText,
  Phone,
  PhoneCall,
  PhoneOff,
  RefreshCcw,
  Search,
  UserRound,
  XCircle
} from "lucide-react";
import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { ErrorAlert, SuccessAlert, WarningAlert } from "@/components/alert";
import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/UI/Badge";
import { GlassCard } from "@/components/UI/GlassCard";
import { Input } from "@/components/UI/Input";
import { NeonButton } from "@/components/UI/NeonButton";
import { Select } from "@/components/UI/Select";
import { apiFetch, describeError, getStoredUser } from "@/lib/api";
import type { ConsultationCallStatus, Customer, CustomerDetail, CustomerStatus, MessageStatus, SessionUser } from "@/lib/types";

type CustomerResponse = {
  customers: Customer[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

type CallForm = {
  callStatus: ConsultationCallStatus;
  messageStatus: MessageStatus;
  noMessageReason: string;
  status: CustomerStatus | "";
  note: string;
  result: string;
  callHistoryImage: string;
  callHistoryImageName: string;
};

type CallState = "all" | "not_called" | "called";

const emptyCallForm = (): CallForm => ({
  callStatus: "CALLED",
  messageStatus: "SENT",
  noMessageReason: "",
  status: "",
  note: "",
  result: "",
  callHistoryImage: "",
  callHistoryImageName: ""
});

const numberFormat = new Intl.NumberFormat("vi-VN");
const dateHeadingFormat = new Intl.DateTimeFormat("vi-VN", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});
const timeFormat = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit"
});

const localDateKey = (value?: string | null) => {
  if (!value) return "unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const dateHeading = (key: string) => {
  if (key === "unknown") return "Chưa có ngày nhận";
  return dateHeadingFormat.format(new Date(`${key}T00:00:00`));
};

const receivedAtValue = (customer: Customer) => customer.receivedAt || customer.updatedAt;
const callStateOfCustomer = (customer: Customer): Exclude<CallState, "all"> =>
  customer.interactions?.some((interaction) => interaction.callStatus) ? "called" : "not_called";

const callStateItems: Array<{ key: Exclude<CallState, "all">; label: string; icon: typeof PhoneCall; tone: "green" | "amber" }> = [
  { key: "not_called", label: "Chưa gọi", icon: PhoneOff, tone: "amber" },
  { key: "called", label: "Đã gọi", icon: PhoneCall, tone: "green" }
];

const callStatusLabel = (status?: ConsultationCallStatus | null) => {
  if (status === "NOT_REACHED") return "Không gọi được";
  if (status === "CALLED") return "Gọi được";
  return "Chưa gọi";
};

const messageStatusLabel = (status?: MessageStatus | null) => {
  if (status === "SENT") return "Đã nhắn tin";
  if (status === "NOT_SENT") return "Chưa nhắn tin";
  return "";
};

const readImageFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Chỉ được tải lên tệp ảnh"));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      reject(new Error("Ảnh lịch sử cuộc gọi tối đa 5MB"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Không đọc được ảnh lịch sử cuộc gọi"));
    reader.readAsDataURL(file);
  });

export default function MyCustomersPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetail | null>(null);
  const [pagination, setPagination] = useState<CustomerResponse["pagination"] | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CustomerStatus | "">("");
  const [receivedDate, setReceivedDate] = useState("");
  const [callState, setCallState] = useState<CallState>("all");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [callForm, setCallForm] = useState<CallForm>(emptyCallForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "25",
      owner: "me",
      sortBy: "updatedAt",
      sortOrder
    });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (receivedDate) params.set("receivedDate", receivedDate);
    if (callState !== "all") params.set("callState", callState);
    return params.toString();
  }, [callState, page, receivedDate, search, sortOrder, status]);

  const groupedCustomers = useMemo(() => {
    const groups = new Map<string, Record<Exclude<CallState, "all">, Customer[]>>();

    customers.forEach((customer) => {
      const key = localDateKey(receivedAtValue(customer));
      const group = groups.get(key) || { not_called: [], called: [] };
      group[callStateOfCustomer(customer)].push(customer);
      groups.set(key, group);
    });

    return Array.from(groups.entries())
      .sort(([left], [right]) => {
        if (left === "unknown") return 1;
        if (right === "unknown") return -1;
        return sortOrder === "desc" ? right.localeCompare(left) : left.localeCompare(right);
      })
      .map(([key, buckets]) => {
        const callGroups = callStateItems
          .map((item) => ({
            ...item,
            items: buckets[item.key]
          }))
          .filter((item) => item.items.length);

        return {
          key,
          total: callGroups.reduce((sum, item) => sum + item.items.length, 0),
          callGroups
        };
      });
  }, [customers, sortOrder]);

  const loadCustomers = async () => {
    setLoadingList(true);
    setError("");
    try {
      const data = await apiFetch<CustomerResponse>(`/customers?${query}`);
      setCustomers(data.customers);
      setPagination(data.pagination);
      setSelectedId((current) =>
        data.customers.some((customer) => customer.id === current) ? current : data.customers[0]?.id || ""
      );
    } catch (caught) {
      setError(describeError(caught, "Không tải được khách hàng của tôi"));
    } finally {
      setLoadingList(false);
    }
  };

  const loadCustomerDetail = async (customerId: string) => {
    if (!customerId) {
      setSelectedCustomer(null);
      return;
    }

    setLoadingDetail(true);
    setError("");
    try {
      const data = await apiFetch<{ customer: CustomerDetail }>(`/customers/${customerId}`);
      setSelectedCustomer(data.customer);
    } catch (caught) {
      setError(describeError(caught, "Không tải được thông tin khách hàng"));
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    if (user?.role === "STAFF") {
      loadCustomers();
    }
  }, [query, user?.role]);

  useEffect(() => {
    if (selectedId) {
      loadCustomerDetail(selectedId);
    } else {
      setSelectedCustomer(null);
    }
  }, [selectedId]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    loadCustomers();
  };

  const refresh = async () => {
    await loadCustomers();
    if (selectedId) {
      await loadCustomerDetail(selectedId);
    }
  };

  const handleImageChange = async (file?: File | null) => {
    if (!file) {
      setCallForm((old) => ({ ...old, callHistoryImage: "", callHistoryImageName: "" }));
      return;
    }

    setError("");
    try {
      const image = await readImageFile(file);
      setCallForm((old) => ({ ...old, callHistoryImage: image, callHistoryImageName: file.name }));
    } catch (caught) {
      setCallForm((old) => ({ ...old, callHistoryImage: "", callHistoryImageName: "" }));
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const saveCall = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCustomer) return;

    setSaving(true);
    setError("");
    setMessage("");
    try {
      await apiFetch(`/customers/${selectedCustomer.id}/interactions`, {
        method: "POST",
        json: {
          note: callForm.note,
          result: callForm.result || null,
          status: callForm.status || undefined,
          callStatus: callForm.callStatus,
          messageStatus: callForm.callStatus === "CALLED" ? callForm.messageStatus : null,
          noMessageReason:
            callForm.callStatus === "CALLED" && callForm.messageStatus === "NOT_SENT"
              ? callForm.noMessageReason
              : null,
          callHistoryImage: callForm.callHistoryImage || null
        }
      });
      setCallForm(emptyCallForm());
      setMessage("Đã lưu kết quả cuộc gọi.");
      await refresh();
    } catch (caught) {
      setError(describeError(caught, "Không thể lưu kết quả cuộc gọi"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <PageHeading
        title="Khách hàng của tôi"
        subtitle="Danh sách khách hàng đã nhận, thông tin liên hệ và xác nhận kết quả sau mỗi lần gọi điện."
      />

      {error ? <ErrorAlert className="mb-4">{error}</ErrorAlert> : null}
      {message ? <SuccessAlert className="mb-4">{message}</SuccessAlert> : null}

      {!user ? (
        <div className="glass-card p-4 text-sm text-slate-400">Đang tải quyền truy cập...</div>
      ) : user.role !== "STAFF" ? (
        <WarningAlert>Trang này dành cho tài khoản nhân viên.</WarningAlert>
      ) : (
        <div className="space-y-5">
          <form onSubmit={submitSearch} className="glass-card p-3">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_170px_170px_150px_auto]">
              <label className="block">
                <span className="sr-only">Tìm kiếm khách hàng</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Tìm theo công ty, người đứng đầu, số điện thoại, địa điểm, thành phố"
                    className="!pl-10"
                  />
                </div>
              </label>
              <label className="block">
                <span className="sr-only">Ngày nhận</span>
                <Input
                  type="date"
                  value={receivedDate}
                  onChange={(event) => {
                    setReceivedDate(event.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <Select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as CustomerStatus | "");
                  setPage(1);
                }}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="NEW">Mới</option>
                <option value="INTERESTED">Quan tâm</option>
                <option value="NOT_INTERESTED">Không quan tâm</option>
                <option value="FOLLOW_UP">Cần gọi lại</option>
                <option value="CONTACTED">Đã liên hệ</option>
                <option value="CUSTOMER">Đã mua</option>
              </Select>
              <Select
                value={sortOrder}
                onChange={(event) => {
                  setSortOrder(event.target.value);
                  setPage(1);
                }}
              >
                <option value="desc">Mới cập nhật</option>
                <option value="asc">Cũ hơn</option>
              </Select>
              <NeonButton type="submit">
                <Search className="h-4 w-4" aria-hidden="true" />
                Tìm
              </NeonButton>
            </div>
          </form>

          <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
            <GlassCard>
              <div className="flex items-center justify-between gap-3 border-b border-cyan-300/10 px-4 py-3">
                <div>
                  <h2 className="text-base font-semibold text-white">Danh sách đã nhận</h2>
                  <div className="mt-1 text-sm text-slate-400">
                    {pagination ? `${numberFormat.format(pagination.total)} khách hàng` : "Đang tải"}
                  </div>
                </div>
                <NeonButton type="button" variant="secondary" className="h-9" onClick={refresh}>
                  <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                  Tải lại
                </NeonButton>
              </div>
              <CallStateTabs
                value={callState}
                onChange={(value) => {
                  setCallState(value);
                  setPage(1);
                }}
              />
              <div className="max-h-[calc(100vh-340px)] min-h-80 overflow-auto p-3">
                {loadingList ? (
                  <div className="p-3 text-sm text-slate-400">Đang tải danh sách...</div>
                ) : customers.length ? (
                  <div className="space-y-4">
                    {groupedCustomers.map((group) => (
                      <section key={group.key} className="space-y-2">
                        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-lg border border-cyan-300/[0.16] bg-slate-950/90 px-3 py-2 backdrop-blur-xl">
                          <div className="flex min-w-0 items-center gap-2">
                            <CalendarDays className="h-4 w-4 shrink-0 text-cyan-200" aria-hidden="true" />
                            <span className="truncate text-sm font-semibold text-cyan-50">{dateHeading(group.key)}</span>
                          </div>
                          <Badge tone="cyan">{numberFormat.format(group.total)} khách</Badge>
                        </div>
                        {group.callGroups.map((callGroup) => {
                          const Icon = callGroup.icon;
                          return (
                            <div key={`${group.key}-${callGroup.key}`} className="space-y-2 rounded-lg border border-white/[0.08] bg-white/[0.025] p-2">
                              <div className="flex items-center justify-between gap-3 px-1">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                                  <Icon className="h-4 w-4 text-cyan-200" aria-hidden="true" />
                                  {callGroup.label}
                                </div>
                                <Badge tone={callGroup.tone}>{numberFormat.format(callGroup.items.length)} khách</Badge>
                              </div>
                              {callGroup.items.map((customer) => (
                                <CustomerListItem
                                  key={customer.id}
                                  customer={customer}
                                  active={selectedId === customer.id}
                                  onSelect={() => setSelectedId(customer.id)}
                                />
                              ))}
                            </div>
                          );
                        })}
                      </section>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-300/[0.24] bg-amber-300/[0.08] p-4 text-sm leading-6 text-amber-100">
                    Bạn chưa có khách hàng nào trong danh sách chăm sóc.
                    <Link href="/customers" className="mt-3 inline-flex font-semibold text-cyan-100 hover:text-white">
                      Sang trang Nhận dữ liệu khách hàng
                    </Link>
                  </div>
                )}
              </div>
              {pagination ? (
                <div className="flex items-center justify-between border-t border-cyan-300/10 px-4 py-3 text-sm">
                  <span className="text-slate-400">Trang {pagination.page}/{Math.max(pagination.totalPages, 1)}</span>
                  <div className="flex gap-2">
                    <NeonButton type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="h-9">Trước</NeonButton>
                    <NeonButton type="button" variant="secondary" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)} className="h-9">Sau</NeonButton>
                  </div>
                </div>
              ) : null}
            </GlassCard>

            <div className="space-y-5">
              {loadingDetail ? (
                <div className="glass-card p-4 text-sm text-slate-400">Đang tải thông tin khách hàng...</div>
              ) : selectedCustomer ? (
                <>
                  <CustomerInfo customer={selectedCustomer} />
                  <CallUpdateForm
                    customer={selectedCustomer}
                    form={callForm}
                    saving={saving}
                    setForm={setCallForm}
                    onImageChange={handleImageChange}
                    onSubmit={saveCall}
                  />
                  <CallHistory customer={selectedCustomer} />
                </>
              ) : (
                <div className="glass-card p-4 text-sm text-slate-400">Chọn một khách hàng để xem thông tin và cập nhật cuộc gọi.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function CallStateTabs({
  value,
  onChange
}: {
  value: CallState;
  onChange: (value: CallState) => void;
}) {
  const items: Array<{ key: CallState; label: string; icon: typeof PhoneCall }> = [
    { key: "all", label: "Tất cả", icon: ClipboardList },
    { key: "not_called", label: "Chưa gọi", icon: PhoneOff },
    { key: "called", label: "Đã gọi", icon: PhoneCall }
  ];

  return (
    <div className="border-b border-cyan-300/10 p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          const active = value === item.key;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={`flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition focus-ring ${
                active
                  ? "border-cyan-300/[0.45] bg-cyan-300/[0.14] text-white shadow-neon"
                  : "border-white/[0.10] bg-white/[0.04] text-slate-300 hover:border-cyan-300/[0.28] hover:bg-cyan-300/[0.08] hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CustomerInfo({ customer }: { customer: CustomerDetail }) {
  return (
    <GlassCard>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-cyan-300/10 px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold text-white">{customer.name}</h2>
          <div className="mt-1 text-sm text-slate-400">{customer.companyHead || "Chưa có người đứng đầu công ty"}</div>
        </div>
        <StatusBadge status={customer.status} />
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
        <InfoItem icon={Building2} label="Tên công ty" value={customer.name || "-"} />
        <InfoItem icon={UserRound} label="Người đứng đầu" value={customer.companyHead || "-"} />
        <InfoItem icon={Phone} label="Số điện thoại" value={customer.phone || "-"} />
        <InfoItem icon={MapPin} label="Địa điểm" value={customer.address || "-"} />
        <InfoItem icon={MapPin} label="Thành phố" value={customer.city || "-"} />
        <InfoItem icon={ClipboardList} label="Lô dữ liệu" value={customer.importHistory?.importName || customer.importHistory?.filename || "-"} />
        <InfoItem icon={CalendarDays} label="Ngày nhận dữ liệu" value={customer.receivedAt ? new Date(customer.receivedAt).toLocaleString("vi-VN") : "-"} />
        <InfoItem icon={UserRound} label="Người phụ trách" value={customer.owner?.name || "-"} />
      </div>
      {customer.phone ? (
        <div className="border-t border-cyan-300/10 px-4 py-3">
          <a
            href={`tel:${customer.phone}`}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-emerald-300/[0.45] bg-emerald-400/[0.14] px-4 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-400/[0.22] focus-ring"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            Gọi khách hàng
          </a>
        </div>
      ) : null}
    </GlassCard>
  );
}

function CustomerListItem({
  customer,
  active,
  onSelect
}: {
  customer: Customer;
  active: boolean;
  onSelect: () => void;
}) {
  const receivedAt = receivedAtValue(customer);
  const receivedDate = receivedAt ? new Date(receivedAt) : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border p-3 text-left transition focus-ring ${
        active
          ? "border-cyan-300/[0.45] bg-cyan-300/[0.12] shadow-neon"
          : "border-white/[0.10] bg-white/[0.04] hover:border-cyan-300/[0.28] hover:bg-cyan-300/[0.07]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{customer.name}</div>
          <div className="mt-1 truncate text-xs text-slate-400">{customer.companyHead || "Chưa có người đứng đầu"}</div>
        </div>
        <StatusBadge status={customer.status} />
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <Phone className="h-3.5 w-3.5 text-cyan-200" aria-hidden="true" />
          {customer.phone || "-"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-cyan-200" aria-hidden="true" />
          {customer.city || customer.address || "-"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 text-cyan-200" aria-hidden="true" />
          Nhận lúc {receivedDate ? timeFormat.format(receivedDate) : "-"}
        </span>
      </div>
    </button>
  );
}

function CallUpdateForm({
  customer,
  form,
  saving,
  setForm,
  onImageChange,
  onSubmit
}: {
  customer: CustomerDetail;
  form: CallForm;
  saving: boolean;
  setForm: (updater: (old: CallForm) => CallForm) => void;
  onImageChange: (file?: File | null) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="glass-card p-4">
      <div className="mb-4 flex items-center gap-2 border-b border-cyan-300/10 pb-3">
        <Phone className="h-4 w-4 text-brand" aria-hidden="true" />
        <h2 className="text-base font-semibold text-white">Cập nhật sau cuộc gọi</h2>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-300">Xác nhận cuộc gọi</span>
          <Select value={form.callStatus} onChange={(event) => setForm((old) => ({ ...old, callStatus: event.target.value as ConsultationCallStatus }))}>
            <option value="CALLED">Gọi được</option>
            <option value="NOT_REACHED">Không gọi được</option>
          </Select>
        </label>

        {form.callStatus === "CALLED" ? (
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-300">Tin nhắn sau cuộc gọi</span>
            <Select value={form.messageStatus} onChange={(event) => setForm((old) => ({ ...old, messageStatus: event.target.value as MessageStatus }))}>
              <option value="SENT">Đã nhắn tin</option>
              <option value="NOT_SENT">Chưa nhắn tin</option>
            </Select>
          </label>
        ) : null}

        {form.callStatus === "CALLED" && form.messageStatus === "NOT_SENT" ? (
          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-300">Lý do chưa nhắn tin</span>
            <Input
              value={form.noMessageReason}
              required
              onChange={(event) => setForm((old) => ({ ...old, noMessageReason: event.target.value }))}
              placeholder="Ví dụ: khách chưa dùng Zalo, khách hẹn nhắn sau..."
            />
          </label>
        ) : null}

        <label className="block md:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-300">Cập nhật kết quả khách hàng</span>
          <Select value={form.status} onChange={(event) => setForm((old) => ({ ...old, status: event.target.value as CustomerStatus | "" }))}>
            <option value="">Giữ nguyên trạng thái hiện tại</option>
            <option value="INTERESTED">Quan tâm</option>
            <option value="NOT_INTERESTED">Không quan tâm</option>
          </Select>
        </label>
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-sm font-medium text-slate-300">Nội dung tư vấn</span>
        <textarea
          value={form.note}
          onChange={(event) => setForm((old) => ({ ...old, note: event.target.value }))}
          required
          rows={4}
          className="neon-field min-h-28 w-full px-3 py-2"
          placeholder={`Ví dụ: đã gọi cho ${customer.companyHead || customer.name}, khách phản hồi...`}
        />
      </label>

      <Input
        value={form.result}
        onChange={(event) => setForm((old) => ({ ...old, result: event.target.value }))}
        className="mt-3"
        placeholder="Kết quả chi tiết"
      />

      <label className="mt-3 block rounded-lg border border-dashed border-cyan-300/[0.28] bg-cyan-300/[0.05] p-4 transition hover:border-cyan-300/[0.45] hover:bg-cyan-300/[0.08]">
        <span className="flex items-center gap-2 text-sm font-semibold text-cyan-50">
          <ImagePlus className="h-4 w-4" aria-hidden="true" />
          Ảnh lịch sử cuộc gọi
        </span>
        <span className="mt-1 block text-xs text-slate-400">Tải ảnh chụp màn hình lịch sử cuộc gọi, tối đa 5MB.</span>
        <input
          type="file"
          accept="image/*"
          className="mt-3 block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-300/[0.16] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-cyan-50"
          onChange={(event) => onImageChange(event.target.files?.[0] || null)}
        />
        {form.callHistoryImage ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
            <img src={form.callHistoryImage} alt="Ảnh lịch sử cuộc gọi đã chọn" className="h-28 w-full rounded-lg border border-cyan-300/[0.18] object-cover" />
            <div className="text-sm text-slate-300">
              <div className="font-semibold text-white">{form.callHistoryImageName || "Ảnh đã chọn"}</div>
              <button
                type="button"
                onClick={() => setForm((old) => ({ ...old, callHistoryImage: "", callHistoryImageName: "" }))}
                className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-rose-300/[0.35] bg-rose-400/[0.12] px-3 text-sm font-semibold text-rose-50 transition hover:bg-rose-400/[0.20] focus-ring"
              >
                <XCircle className="h-4 w-4" aria-hidden="true" />
                Bỏ ảnh
              </button>
            </div>
          </div>
        ) : null}
      </label>

      <NeonButton type="submit" variant="success" disabled={saving} className="mt-4 w-full">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        {saving ? "Đang lưu..." : "Lưu kết quả cuộc gọi"}
      </NeonButton>
    </form>
  );
}

function CallHistory({ customer }: { customer: CustomerDetail }) {
  return (
    <GlassCard>
      <div className="flex items-center gap-2 border-b border-cyan-300/10 px-4 py-3">
        <MessageSquareText className="h-4 w-4 text-brand" aria-hidden="true" />
        <h2 className="text-base font-semibold text-white">Lịch sử cuộc gọi và chăm sóc</h2>
      </div>
      <div className="divide-y divide-cyan-300/10">
        {customer.interactions.length ? (
          customer.interactions.map((interaction) => (
            <article key={interaction.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium text-white">{interaction.user.name}</div>
                <div className="text-xs text-slate-400">{new Date(interaction.createdAt).toLocaleString("vi-VN")}</div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge tone={interaction.callStatus === "CALLED" ? "green" : "amber"}>
                  {callStatusLabel(interaction.callStatus)}
                </Badge>
                {interaction.messageStatus ? <Badge tone="cyan">{messageStatusLabel(interaction.messageStatus)}</Badge> : null}
                {interaction.noMessageReason ? <Badge tone="amber">Lý do: {interaction.noMessageReason}</Badge> : null}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{interaction.note}</p>
              {interaction.result ? <div className="mt-1 text-xs text-slate-400">Kết quả: {interaction.result}</div> : null}
              {interaction.callHistoryImage ? (
                <a href={interaction.callHistoryImage} target="_blank" rel="noreferrer" className="mt-3 block max-w-xs">
                  <img src={interaction.callHistoryImage} alt="Ảnh lịch sử cuộc gọi" className="max-h-52 w-full rounded-lg border border-cyan-300/[0.18] object-cover" />
                  <span className="mt-1 block text-xs font-semibold text-cyan-100">Mở ảnh lịch sử cuộc gọi</span>
                </a>
              ) : null}
            </article>
          ))
        ) : (
          <div className="px-4 py-3 text-sm text-slate-400">Chưa có lịch sử cuộc gọi.</div>
        )}
      </div>
    </GlassCard>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Building2;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-cyan-300/[0.10] bg-white/[0.04] p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5 text-cyan-200" aria-hidden="true" />
        {label}
      </div>
      <div className="break-words text-sm font-medium text-white">{value}</div>
    </div>
  );
}
