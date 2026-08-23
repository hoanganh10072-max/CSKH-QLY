"use client";

import { CheckCircle2, RefreshCcw, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ErrorAlert, WarningAlert } from "@/components/alert";
import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { NeonButton } from "@/components/UI/NeonButton";
import { Select } from "@/components/UI/Select";
import { GlassTable, TableBody, TableHead, TableRow, Td, Th } from "@/components/UI/Table";
import { apiFetch, describeError, getStoredUser } from "@/lib/api";
import type { SessionUser, Task, TaskStatus } from "@/lib/types";

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<TaskStatus | "">("TODO");
  const [due, setDue] = useState("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ due });
    if (status) params.set("status", status);
    try {
      const data = await apiFetch<{ tasks: Task[] }>(`/tasks?${params.toString()}`);
      setTasks(data.tasks);
    } catch (caught) {
      setError(describeError(caught, "Không tải được công việc"));
    } finally {
      setLoading(false);
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
  }, [status, due]);

  const updateStatus = async (taskId: string, nextStatus: TaskStatus) => {
    setBusyId(taskId);
    setError("");
    try {
      await apiFetch(`/tasks/${taskId}`, { method: "PATCH", json: { status: nextStatus } });
      await load();
    } catch (caught) {
      setError(describeError(caught, "Không thể cập nhật công việc"));
    } finally {
      setBusyId("");
    }
  };

  return (
    <AppShell>
      <PageHeading title="Công việc" subtitle="Theo dõi việc cần làm, hạn xử lý hôm nay và các công việc quá hạn." />

      {user && user.role !== "ADMIN" ? <WarningAlert>Chức năng Công việc chỉ dành cho quản trị viên.</WarningAlert> : null}

      {user?.role === "ADMIN" ? (
      <>
      <div className="glass-card mb-4 flex flex-wrap items-center gap-3 p-3">
        <Select value={status} onChange={(event) => setStatus(event.target.value as TaskStatus | "")} className="w-full sm:w-48">
          <option value="">Tất cả trạng thái</option>
          <option value="TODO">Cần làm</option>
          <option value="DONE">Hoàn tất</option>
          <option value="CANCELLED">Đã hủy</option>
        </Select>
        <Select value={due} onChange={(event) => setDue(event.target.value)} className="w-full sm:w-48">
          <option value="all">Tất cả hạn xử lý</option>
          <option value="today">Hôm nay</option>
          <option value="overdue">Quá hạn</option>
        </Select>
        <NeonButton type="button" variant="secondary" onClick={load}>
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          Tải lại
        </NeonButton>
      </div>

      {error ? <ErrorAlert className="mb-4">{error}</ErrorAlert> : null}

      <section className="glass-card">
        <GlassTable className="border-0">
            <TableHead>
              <tr>
                <Th>Công việc</Th>
                <Th>Khách hàng</Th>
                <Th>Hạn xử lý</Th>
                <Th>Trạng thái</Th>
                <Th className="text-right">Thao tác</Th>
              </tr>
            </TableHead>
            <TableBody>
              {loading ? (
                <tr><Td className="py-6 text-slate-400" colSpan={5}>Đang tải...</Td></tr>
              ) : tasks.length ? (
                tasks.map((task) => (
                  <TableRow key={task.id}>
                    <Td className="font-medium text-white">{task.title}</Td>
                    <Td>
                      {task.customer ? (
                        <Link href={`/customers/${task.customer.id}`} className="text-cyan-200 hover:text-cyan-100 hover:underline">
                          {task.customer.name}
                        </Link>
                      ) : "-"}
                    </Td>
                    <Td className="text-slate-300">{new Date(task.deadline).toLocaleString("vi-VN")}</Td>
                    <Td><StatusBadge status={task.status} /></Td>
                    <Td>
                      <div className="flex justify-end gap-2">
                        <NeonButton type="button" variant="success" disabled={busyId === task.id || task.status === "DONE"} onClick={() => updateStatus(task.id, "DONE")} className="h-9 px-3">
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          Hoàn tất
                        </NeonButton>
                        <NeonButton type="button" variant="danger" disabled={busyId === task.id || task.status === "CANCELLED"} onClick={() => updateStatus(task.id, "CANCELLED")} className="h-9 px-3">
                          <XCircle className="h-4 w-4" aria-hidden="true" />
                          Hủy
                        </NeonButton>
                      </div>
                    </Td>
                  </TableRow>
                ))
              ) : (
                <tr><Td className="py-6 text-slate-400" colSpan={5}>Không có công việc phù hợp.</Td></tr>
              )}
            </TableBody>
          </GlassTable>
      </section>
      </>
      ) : null}
    </AppShell>
  );
}
