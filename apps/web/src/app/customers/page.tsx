"use client";

import { CalendarDays, ClipboardCheck, Database, Eye, RefreshCcw, Search, Target, UserPlus } from "lucide-react";
import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { ErrorAlert, SuccessAlert } from "@/components/alert";
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
import type { Customer, CustomerStatus, SessionUser } from "@/lib/types";
import { customerStatuses } from "@/lib/types";

type CustomerResponse = {
  customers: Customer[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

type ReceivingSummary = {
  date: string;
  receivedToday: number;
  dailyTarget: number;
  availableCustomers: number;
};

const numberFormat = new Intl.NumberFormat("vi-VN");
const dateFormat = new Intl.DateTimeFormat("vi-VN", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

const currencyFormat = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0
});

export default function CustomersPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [receivingSummary, setReceivingSummary] = useState<ReceivingSummary | null>(null);
  const [pagination, setPagination] = useState<CustomerResponse["pagination"] | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CustomerStatus | "">("");
  const [owner, setOwner] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "25",
      owner,
      sortBy,
      sortOrder
    });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    return params.toString();
  }, [owner, page, search, sortBy, sortOrder, status]);

  const isStaff = user?.role === "STAFF";

  const staffQuery = (nextOwner: "me" | "unassigned", pageSize = "25") => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize,
      owner: nextOwner,
      sortBy,
      sortOrder
    });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    return params.toString();
  };

  const load = async () => {
    if (!user) return;

    setLoading(true);
    setError("");
    try {
      if (user.role === "STAFF") {
        const [availableData, summaryData] = await Promise.all([
          apiFetch<CustomerResponse>(`/customers?${staffQuery("unassigned")}`),
          apiFetch<ReceivingSummary>("/customers/receiving-summary")
        ]);
        setCustomers(availableData.customers);
        setReceivingSummary(summaryData);
        setPagination(availableData.pagination);
      } else {
        const data = await apiFetch<CustomerResponse>(`/customers?${query}`);
        setCustomers(data.customers);
        setPagination(data.pagination);
      }
    } catch (caught) {
      setError(describeError(caught, "Không tải được danh sách khách hàng"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    load();
  }, [query, user?.role]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    load();
  };

  const claim = async (customerId: string) => {
    setBusyId(customerId);
    setError("");
    setMessage("");
    try {
      const data = await apiFetch<{ customer: Customer }>(`/customers/${customerId}/claim`, { method: "POST" });
      const ownerName = data.customer.owner?.name || "nhân viên hiện tại";
      setMessage(`Đã nhận chăm sóc: ${ownerName}. Khách hàng đã chuyển sang trang Khách hàng của tôi.`);
      await load();
    } catch (caught) {
      setError(describeError(caught, "Không thể nhận chăm sóc"));
    } finally {
      setBusyId("");
    }
  };

  return (
    <AppShell>
      <PageHeading
        title={isStaff ? "Nhận dữ liệu khách hàng" : "Khách hàng"}
        subtitle={isStaff ? "Xem dữ liệu khách hàng do quản trị viên nhập và nhận khách hàng vào danh sách chăm sóc của bạn." : "Kho dữ liệu công ty, lọc theo trạng thái, người phụ trách, thành phố và doanh thu."}
      />

      {isStaff ? <ReceivingStats summary={receivingSummary} loading={loading} /> : null}

      <form onSubmit={submitSearch} className="glass-card mb-5 p-3">
        <div className={isStaff ? "grid gap-3 md:grid-cols-[1fr_160px_140px_auto]" : "grid gap-3 md:grid-cols-[1fr_180px_180px_160px_140px_auto]"}>
          <label className="block">
            <span className="sr-only">Tìm kiếm</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Công ty, người đứng đầu, số điện thoại, địa điểm, thành phố"
                className="!pl-10"
              />
            </div>
          </label>

          {!isStaff ? (
            <Select value={status} onChange={(event) => setStatus(event.target.value as CustomerStatus | "")}>
              <option value="">Tất cả trạng thái</option>
              {customerStatuses.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </Select>
          ) : null}

          {!isStaff ? (
            <Select value={owner} onChange={(event) => setOwner(event.target.value)}>
              <option value="all">Tất cả người phụ trách</option>
              <option value="unassigned">Chưa có người phụ trách</option>
              <option value="assigned">Đã có người phụ trách</option>
              <option value="me">Khách của tôi</option>
            </Select>
          ) : null}

          <Select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="createdAt">Ngày tạo</option>
            <option value="updatedAt">Cập nhật</option>
            <option value="name">Tên</option>
            <option value="status">Trạng thái</option>
            <option value="city">Thành phố</option>
          </Select>

          <Select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
            <option value="desc">Giảm dần</option>
            <option value="asc">Tăng dần</option>
          </Select>

          <NeonButton type="submit">
            <Search className="h-4 w-4" aria-hidden="true" />
            Tìm
          </NeonButton>
        </div>
      </form>

      {error ? <ErrorAlert className="mb-4">{error}</ErrorAlert> : null}
      {message ? <SuccessAlert className="mb-4">{message}</SuccessAlert> : null}

      {isStaff ? (
        <CustomerSection
          title="Dữ liệu khách hàng"
          subtitle={pagination ? `${numberFormat.format(pagination.total)} dữ liệu đang chờ nhận` : "Đang tải dữ liệu"}
          loading={loading}
          customers={customers}
          emptyText="Không có dữ liệu nào đang chờ nhận."
          rightAction={<NeonButton type="button" variant="secondary" onClick={load} className="h-9"><RefreshCcw className="h-4 w-4" aria-hidden="true" />Tải lại</NeonButton>}
          columns={
            <>
              <Th>Tên công ty</Th>
              <Th>Người đứng đầu</Th>
              <Th>Địa điểm</Th>
              <Th>Số điện thoại</Th>
              <Th>Thành phố</Th>
              <Th>Lô dữ liệu</Th>
              <Th className="text-right">Thao tác</Th>
            </>
          }
          renderRow={(customer) => (
            <>
              <CompanyCell customer={customer} />
              <Td>{customer.companyHead || "-"}</Td>
              <LocationCell customer={customer} />
              <Td className="font-semibold text-white">{customer.phone || "-"}</Td>
              <Td>{customer.city || "-"}</Td>
              <ImportCell customer={customer} />
              <Td>
                <div className="flex justify-end gap-2">
                  <ActionLink customer={customer} />
                  <button
                    type="button"
                    disabled={busyId === customer.id}
                    onClick={() => claim(customer.id)}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-300/[0.45] bg-emerald-400/[0.14] px-3 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-400/[0.22] focus-ring disabled:opacity-60"
                  >
                    <UserPlus className="h-4 w-4" aria-hidden="true" />
                    {busyId === customer.id ? "Đang nhận" : "Nhận"}
                  </button>
                </div>
              </Td>
            </>
          )}
          colSpan={7}
          pagination={pagination}
          page={page}
          onPrev={() => setPage((value) => value - 1)}
          onNext={() => setPage((value) => value + 1)}
        />
      ) : (
        <CustomerSection
          title="Danh sách khách hàng"
          subtitle={pagination ? `${pagination.total} khách hàng` : "Đang tải"}
          loading={loading}
          customers={customers}
          emptyText="Không có khách hàng phù hợp."
          rightAction={<NeonButton type="button" variant="secondary" onClick={load} className="h-9"><RefreshCcw className="h-4 w-4" aria-hidden="true" />Tải lại</NeonButton>}
          columns={
            <>
              <Th>Khách hàng</Th>
              <Th>Liên hệ</Th>
              <Th>Địa điểm</Th>
              <Th>Thành phố</Th>
              <Th>Trạng thái</Th>
              <Th className="text-right">Doanh thu</Th>
              <Th>Người phụ trách</Th>
              <Th className="text-right">Thao tác</Th>
            </>
          }
          renderRow={(customer) => (
            <>
            <CustomerIdentity customer={customer} />
            <CustomerContact customer={customer} />
            <LocationCell customer={customer} />
            <Td>{customer.city || "-"}</Td>
            <Td><StatusBadge status={customer.status} /></Td>
              <Td className="text-right text-white">{currencyFormat.format(Number(customer.revenue || 0))}</Td>
              <Td>
                {customer.owner?.name ? (
                  <span className="inline-flex rounded-full border border-emerald-300/[0.35] bg-emerald-300/[0.12] px-2 py-1 text-xs font-medium text-emerald-100">
                    Đã nhận: {customer.owner.name}
                  </span>
                ) : (
                  <span className="text-slate-400">Chưa có</span>
                )}
              </Td>
              <ActionCell customer={customer} />
            </>
        )}
        colSpan={8}
          pagination={pagination}
          page={page}
          onPrev={() => setPage((value) => value - 1)}
          onNext={() => setPage((value) => value + 1)}
        />
      )}
    </AppShell>
  );
}

function ReceivingStats({ summary, loading }: { summary: ReceivingSummary | null; loading: boolean }) {
  const receivedToday = summary?.receivedToday ?? 0;
  const dailyTarget = summary?.dailyTarget ?? 0;
  const availableCustomers = summary?.availableCustomers ?? 0;
  const progress = dailyTarget > 0 ? Math.min(100, Math.round((receivedToday / dailyTarget) * 100)) : 0;
  const remaining = Math.max(dailyTarget - receivedToday, 0);
  const displayDate = summary?.date ? new Date(summary.date) : new Date();

  return (
    <section className="mb-5 grid gap-4 md:grid-cols-3">
      <ReceivingStatCard
        label="Ngày"
        value={dateFormat.format(displayDate)}
        icon={CalendarDays}
        footer={loading && !summary ? "Đang tải dữ liệu ngày" : "Dữ liệu được tính theo ngày hiện tại"}
      />
      <ReceivingStatCard
        label="Số khách đã nhận"
        value={loading && !summary ? "Đang tải" : `${numberFormat.format(receivedToday)} khách`}
        icon={ClipboardCheck}
        footer={dailyTarget ? `Còn ${numberFormat.format(remaining)} khách để đạt chỉ tiêu` : "Chưa đặt chỉ tiêu ngày"}
      />
      <ReceivingStatCard
        label="Chỉ tiêu 1 ngày"
        value={dailyTarget ? `${numberFormat.format(dailyTarget)} khách` : "Chưa đặt"}
        icon={Target}
        footer={`Dữ liệu đang chờ nhận: ${numberFormat.format(availableCustomers)}`}
        progress={progress}
      />
    </section>
  );
}

function ReceivingStatCard({
  label,
  value,
  icon: Icon,
  footer,
  progress
}: {
  label: string;
  value: ReactNode;
  icon: typeof Database;
  footer: string;
  progress?: number;
}) {
  return (
    <GlassCard className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-slate-400">{label}</div>
          <div className="mt-2 break-words text-2xl font-semibold text-white">{value}</div>
        </div>
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-100 shadow-neon">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      {typeof progress === "number" ? (
        <div className="mt-4 h-2 rounded-full bg-slate-900/80">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300" style={{ width: `${progress}%` }} />
        </div>
      ) : null}
      <div className="mt-3 text-xs text-slate-400">{footer}</div>
    </GlassCard>
  );
}

function CustomerSection({
  title,
  subtitle,
  loading,
  customers,
  emptyText,
  columns,
  renderRow,
  colSpan,
  rightAction,
  pagination,
  page,
  onPrev,
  onNext
}: {
  title: string;
  subtitle: string;
  loading: boolean;
  customers: Customer[];
  emptyText: string;
  columns: ReactNode;
  renderRow: (customer: Customer) => ReactNode;
  colSpan: number;
  rightAction?: ReactNode;
  pagination?: CustomerResponse["pagination"] | null;
  page?: number;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  return (
    <section className="glass-card">
      <div className="flex items-center justify-between gap-3 border-b border-cyan-300/10 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <div className="mt-1 text-sm text-slate-400">{subtitle}</div>
        </div>
        {rightAction}
      </div>
      <GlassTable className="border-0">
        <TableHead>
          <tr>{columns}</tr>
        </TableHead>
        <TableBody>
          {loading ? (
            <tr><Td className="py-6 text-slate-400" colSpan={colSpan}>Đang tải dữ liệu...</Td></tr>
          ) : customers.length ? (
            customers.map((customer) => <TableRow key={customer.id}>{renderRow(customer)}</TableRow>)
          ) : (
            <tr><Td className="py-6 text-slate-400" colSpan={colSpan}>{emptyText}</Td></tr>
          )}
        </TableBody>
      </GlassTable>
      {pagination && page && onPrev && onNext ? (
        <div className="flex items-center justify-between border-t border-cyan-300/10 px-4 py-3 text-sm">
          <span className="text-slate-400">Trang {pagination.page}/{Math.max(pagination.totalPages, 1)}</span>
          <div className="flex gap-2">
            <NeonButton type="button" variant="secondary" disabled={page <= 1} onClick={onPrev} className="h-9">Trước</NeonButton>
            <NeonButton type="button" variant="secondary" disabled={pagination.page >= pagination.totalPages} onClick={onNext} className="h-9">Sau</NeonButton>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CustomerIdentity({ customer }: { customer: Customer }) {
  return (
    <Td>
      <div className="flex items-center gap-3">
        <Avatar name={customer.name} />
        <div>
          <div className="font-medium text-white">{customer.name}</div>
          {customer.companyHead ? <div className="text-xs text-slate-400">Người đứng đầu: {customer.companyHead}</div> : null}
          <div className="text-xs text-slate-500">{new Date(customer.createdAt).toLocaleDateString("vi-VN")}</div>
        </div>
      </div>
    </Td>
  );
}

function CompanyCell({ customer }: { customer: Customer }) {
  return (
    <Td>
      <div className="flex items-center gap-3">
        <Avatar name={customer.name} />
        <div className="min-w-0">
          <div className="font-medium text-white">{customer.name}</div>
          <div className="text-xs text-slate-500">Ngày nhập: {new Date(customer.createdAt).toLocaleDateString("vi-VN")}</div>
        </div>
      </div>
    </Td>
  );
}

function CustomerContact({ customer }: { customer: Customer }) {
  return (
    <Td>
      <div>{customer.phone || "-"}</div>
      <div className="text-xs text-slate-500">{customer.importHistory?.importName || customer.importHistory?.filename || "-"}</div>
    </Td>
  );
}

function ImportCell({ customer }: { customer: Customer }) {
  const importName = customer.importHistory?.importName || customer.importHistory?.filename || "-";

  return (
    <Td>
      <div className="max-w-48 truncate text-sm text-slate-300" title={importName}>
        {importName}
      </div>
    </Td>
  );
}

function LocationCell({ customer }: { customer: Customer }) {
  return (
    <Td>
      <div className="max-w-64 text-sm text-slate-300">{customer.address || "-"}</div>
    </Td>
  );
}

function ActionLink({ customer }: { customer: Customer }) {
  return (
    <Link href={`/customers/${customer.id}`} className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.15] bg-white/[0.06] px-3 text-sm text-slate-100 transition hover:border-cyan-300/[0.35] hover:bg-cyan-300/10 focus-ring">
      <Eye className="h-4 w-4" aria-hidden="true" />
      Xem
    </Link>
  );
}

function ActionCell({ customer }: { customer: Customer }) {
  return (
    <Td>
      <div className="flex justify-end">
        <ActionLink customer={customer} />
      </div>
    </Td>
  );
}
