"use client";

import { BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
import { ErrorAlert, WarningAlert } from "@/components/alert";
import { AppShell } from "@/components/app-shell";
import { DarkChart } from "@/components/Charts/DarkChart";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { Avatar } from "@/components/UI/Avatar";
import { GlassCard } from "@/components/UI/GlassCard";
import { GlassTable, TableBody, TableHead, TableRow, Td, Th } from "@/components/UI/Table";
import { apiFetch, describeError, getStoredUser } from "@/lib/api";
import { useLiveRefresh } from "@/lib/live-sync";
import type { SessionUser } from "@/lib/types";

type ReportsResponse = {
  metrics: {
    totalCustomers: number;
    unassignedCustomers: number;
    activeCustomers: number;
    completedCustomers: number;
    revenue: number;
    staffCount: number;
  };
  staffPerformance: Array<{
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

export default function ReportsPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [error, setError] = useState("");

  const loadReports = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setError("");
    try {
      const nextData = await apiFetch<ReportsResponse>("/dashboard");
      setData(nextData);
    } catch (caught) {
      if (!silent) setError(describeError(caught, "Không tải được báo cáo"));
    }
  };

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);
    if (stored?.role === "ADMIN") {
      loadReports();
    }
  }, []);

  useLiveRefresh(() => loadReports({ silent: true }), {
    enabled: user?.role === "ADMIN",
    intervalMs: 10000,
    areas: ["imports", "customers", "interactions", "users", "tasks", "dashboard"]
  });

  return (
    <AppShell>
      <PageHeading title="Báo cáo" subtitle="Báo cáo tổng hợp dữ liệu và năng suất xử lý của từng nhân viên." />

      {!user ? (
        <div className="glass-card p-4 text-sm text-slate-400">Đang tải quyền truy cập...</div>
      ) : user.role !== "ADMIN" ? (
        <WarningAlert>Chỉ quản trị viên được xem báo cáo.</WarningAlert>
      ) : null}
      {error ? <ErrorAlert className="mb-4">{error}</ErrorAlert> : null}
      {!data && user?.role === "ADMIN" ? <div className="glass-card skeleton h-24 p-4 text-sm text-slate-400">Đang tải báo cáo...</div> : null}

      {data ? (
        <div className="space-y-5">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {[
              { label: "Tổng khách", value: data.metrics.totalCustomers },
              { label: "Chưa có người phụ trách", value: data.metrics.unassignedCustomers },
              { label: "Đang chăm sóc", value: data.metrics.activeCustomers },
              { label: "Đã mua", value: data.metrics.completedCustomers },
              { label: "Doanh thu", value: data.metrics.revenue, formatter: currencyFormat.format },
              { label: "Nhân viên", value: data.metrics.staffCount }
            ].map(({ label, value, formatter = numberFormat.format }) => (
              <GlassCard key={label} className="p-4" hover>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm text-slate-400">{label}</div>
                    <div className="mt-2 text-3xl font-semibold text-white">{formatter(value)}</div>
                  </div>
                  <span className="grid h-11 w-11 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-100 shadow-neon">
                    <BarChart3 className="h-5 w-5" aria-hidden="true" />
                  </span>
                </div>
              </GlassCard>
            ))}
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <DarkChart
              title="Tổng quan phân tích"
              values={[
                data.metrics.totalCustomers || 1,
                data.metrics.unassignedCustomers || 1,
                data.metrics.activeCustomers || 1,
                data.metrics.completedCustomers || 1
              ]}
              labels={["Tổng", "Chưa nhận", "Đang chăm sóc", "Đã mua"]}
            />
            <GlassCard className="p-4">
              <h2 className="text-base font-semibold text-white">Tổng quan hiệu suất</h2>
              <div className="mt-4 space-y-3">
                {data.staffPerformance.slice(0, 4).map((staff) => (
                  <div key={staff.id} className="rounded-lg border border-cyan-300/10 bg-white/[0.04] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={staff.name} />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">{staff.name}</div>
                          <div className="text-xs text-slate-400">{staff.interactions} tương tác</div>
                        </div>
                      </div>
                      <div className="text-right text-sm font-semibold text-cyan-100">{staff.ownedCustomers}</div>
                    </div>
                  </div>
                ))}
                {!data.staffPerformance.length ? <div className="text-sm text-slate-400">Chưa có dữ liệu nhân viên.</div> : null}
              </div>
            </GlassCard>
          </div>

          <GlassCard>
            <div className="border-b border-cyan-300/10 px-4 py-3">
              <h2 className="text-base font-semibold text-white">Bảng hiệu suất</h2>
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
                {data.staffPerformance.map((staff) => (
                  <TableRow key={staff.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={staff.name} />
                        <div>
                          <div className="font-medium text-white">{staff.name}</div>
                          <div className="text-xs text-slate-400">{staff.email}</div>
                        </div>
                      </div>
                    </Td>
                    <Td><StatusBadge status={staff.status} /></Td>
                    <Td className="text-right text-white">{staff.ownedCustomers}</Td>
                    <Td className="text-right text-white">{staff.interactions}</Td>
                    <Td className="text-right text-white">{staff.tasks}</Td>
                  </TableRow>
                ))}
              </TableBody>
            </GlassTable>
          </GlassCard>
        </div>
      ) : null}
    </AppShell>
  );
}
