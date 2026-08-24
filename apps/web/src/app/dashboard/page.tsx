"use client";

import { AlertTriangle, CircleDollarSign, Database, PhoneCall, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { ErrorAlert } from "@/components/alert";
import { AppShell } from "@/components/app-shell";
import { DarkChart } from "@/components/Charts/DarkChart";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { Avatar } from "@/components/UI/Avatar";
import { GlassCard } from "@/components/UI/GlassCard";
import { GlassTable, TableBody, TableHead, TableRow, Td, Th } from "@/components/UI/Table";
import { apiFetch, describeError } from "@/lib/api";
import { useLiveRefresh } from "@/lib/live-sync";

type DashboardResponse = {
  role: "ADMIN" | "STAFF";
  metrics: Record<string, number>;
  imports?: Array<{
    id: string;
    importName?: string | null;
    filename: string;
    totalRows: number;
    successRows: number;
    duplicateRows: number;
    failedRows: number;
    createdAt: string;
    creator?: { name: string } | null;
  }>;
  staffPerformance?: Array<{
    id: string;
    name: string;
    email: string;
    status: "ACTIVE" | "INACTIVE";
    ownedCustomers: number;
    interactions: number;
    tasks: number;
  }>;
};

const numberFormat = new Intl.NumberFormat("vi-VN");
const currencyFormat = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0
});

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState("");

  const loadDashboard = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setError("");
    try {
      const nextData = await apiFetch<DashboardResponse>("/dashboard");
      setData(nextData);
    } catch (caught) {
      if (!silent) setError(describeError(caught, "Không tải được bảng điều khiển"));
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  useLiveRefresh(() => loadDashboard({ silent: true }), {
    intervalMs: 10000,
    areas: ["imports", "customers", "interactions", "users", "tasks", "dashboard"]
  });

  return (
    <AppShell>
      <PageHeading title="Bảng điều khiển" subtitle="Tổng quan dữ liệu, nhân sự phụ trách và việc cần xử lý." />

      {error ? <ErrorAlert className="mb-4">{error}</ErrorAlert> : null}
      {!data ? <div className="glass-card skeleton h-28" /> : null}

      {data ? (
        <>
          {data.role === "ADMIN" ? <AdminDashboard data={data} /> : <StaffDashboard data={data} />}
        </>
      ) : null}
    </AppShell>
  );
}

function MetricPanel({
  label,
  value,
  icon: Icon,
  tone,
  formatter = numberFormat.format
}: {
  label: string;
  value: number;
  icon: typeof Database;
  tone: string;
  formatter?: (value: number) => string;
}) {
  return (
    <GlassCard className="p-4" hover>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-slate-400">{label}</div>
          <div className="mt-2 text-3xl font-semibold text-white">{formatter(value || 0)}</div>
        </div>
        <div className={`grid h-11 w-11 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-100 shadow-neon ${tone}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
    </GlassCard>
  );
}

function AdminDashboard({ data }: { data: DashboardResponse }) {
  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricPanel label="Tổng khách hàng" value={data.metrics.totalCustomers} icon={Database} tone="" />
        <MetricPanel label="Chưa có người chăm sóc" value={data.metrics.unassignedCustomers} icon={AlertTriangle} tone="text-amber-100" />
        <MetricPanel label="Đang chăm sóc" value={data.metrics.activeCustomers} icon={PhoneCall} tone="text-cyan-100" />
        <MetricPanel label="Đã mua" value={data.metrics.completedCustomers} icon={Database} tone="text-emerald-100" />
        <MetricPanel label="Nhân viên" value={data.metrics.staffCount} icon={Users} tone="text-violet-100" />
        <MetricPanel label="Doanh thu" value={data.metrics.revenue} icon={CircleDollarSign} tone="text-emerald-100" formatter={currencyFormat.format} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <DarkChart
          title="Luồng khách hàng"
          values={[
            data.metrics.unassignedCustomers || 1,
            data.metrics.activeCustomers || 1,
            data.metrics.completedCustomers || 1,
            data.metrics.totalCustomers || 1
          ]}
          labels={["Chưa nhận", "Đang chăm sóc", "Đã mua", "Tổng"]}
        />
        <GlassCard className="p-4">
          <h2 className="mb-4 text-base font-semibold text-white">Lịch sử nhập dữ liệu</h2>
          <div className="space-y-3">
            {(data.imports || []).slice(0, 4).map((item) => (
              <div key={item.id} className="rounded-lg border border-cyan-300/10 bg-white/[0.04] p-3">
                <div className="text-sm font-semibold text-cyan-50">{item.importName || item.filename}</div>
                {item.importName ? <div className="mt-1 text-xs text-slate-500">{item.filename}</div> : null}
                <div className="mt-1 text-xs text-slate-400">
                  {item.successRows}/{item.totalRows} đã nhập, {item.duplicateRows} trùng lặp
                </div>
              </div>
            ))}
            {!data.imports?.length ? <div className="text-sm text-slate-400">Chưa có lịch sử nhập dữ liệu.</div> : null}
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <div className="border-b border-cyan-300/10 px-4 py-3">
          <h2 className="text-base font-semibold text-white">Hiệu suất nhân viên</h2>
        </div>
        <GlassTable className="border-0">
          <TableHead>
              <tr>
                <Th>Nhân viên</Th>
                <Th>Trạng thái</Th>
                <Th className="text-right">Khách đang giữ</Th>
                <Th className="text-right">Tương tác</Th>
                <Th className="text-right">Công việc</Th>
              </tr>
          </TableHead>
          <TableBody>
              {data.staffPerformance?.map((staff) => (
                <TableRow key={staff.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                    <Avatar name={staff.name} />
                    <div>
                    <div className="font-medium text-white">{staff.name}</div>
                    <div className="text-xs text-slate-500">{staff.email}</div>
                    </div>
                    </div>
                  </Td>
                  <Td><StatusBadge status={staff.status} /></Td>
                  <Td className="text-right">{staff.ownedCustomers}</Td>
                  <Td className="text-right">{staff.interactions}</Td>
                  <Td className="text-right">{staff.tasks}</Td>
                </TableRow>
              ))}
          </TableBody>
        </GlassTable>
      </GlassCard>
    </div>
  );
}

function StaffDashboard({ data }: { data: DashboardResponse }) {
  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricPanel label="Dữ liệu có thể nhận" value={data.metrics.availableCustomers} icon={Database} tone="" />
        <MetricPanel label="Dữ liệu của tôi" value={data.metrics.myCustomers} icon={Users} tone="text-cyan-100" />
        <MetricPanel label="Khách quan tâm" value={data.metrics.interestedCustomers} icon={PhoneCall} tone="text-emerald-100" />
        <MetricPanel label="Không quan tâm" value={data.metrics.notInterestedCustomers} icon={AlertTriangle} tone="text-rose-100" />
        <MetricPanel label="Doanh thu của tôi" value={data.metrics.myRevenue} icon={CircleDollarSign} tone="text-emerald-100" formatter={currencyFormat.format} />
      </section>

      <GlassCard className="p-4">
        <h2 className="text-base font-semibold text-white">Quy trình nhận dữ liệu</h2>
        <div className="mt-3 grid gap-3 text-sm text-slate-300 md:grid-cols-3">
          <div className="rounded-lg border border-cyan-300/10 bg-white/[0.04] p-3">1. Vào Nhận dữ liệu khách hàng và chọn khách chưa có người phụ trách.</div>
          <div className="rounded-lg border border-cyan-300/10 bg-white/[0.04] p-3">2. Bấm Nhận để lấy khách về danh sách Khách hàng của tôi.</div>
          <div className="rounded-lg border border-cyan-300/10 bg-white/[0.04] p-3">3. Vào Khách hàng của tôi để gọi điện, tải ảnh lịch sử cuộc gọi và cập nhật kết quả.</div>
        </div>
      </GlassCard>
    </div>
  );
}
