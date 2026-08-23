"use client";

import { CheckCircle2, Clock3, Save, UserMinus, UserPlus } from "lucide-react";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ErrorAlert, SuccessAlert } from "@/components/alert";
import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { GlassCard } from "@/components/UI/GlassCard";
import { Input } from "@/components/UI/Input";
import { NeonButton } from "@/components/UI/NeonButton";
import { Select } from "@/components/UI/Select";
import { apiFetch, describeError, getStoredUser } from "@/lib/api";
import type { ConsultationCallStatus, CustomerDetail, CustomerStatus, MessageStatus, SessionUser } from "@/lib/types";
import { customerStatuses } from "@/lib/types";

const toDatetimeLocal = (date: Date) => {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
};

const emptyEditForm = {
  name: "",
  companyHead: "",
  phone: "",
  address: "",
  city: "",
  status: "NEW" as CustomerStatus,
  revenue: "0"
};

const currencyFormat = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0
});

const revenueValue = (value: CustomerDetail["revenue"]) => Number(value || 0);

const callStatusLabel = (status?: ConsultationCallStatus | null) => {
  if (status === "NOT_REACHED") return "Chưa gọi được";
  if (status === "CALLED") return "Gọi được";
  return "Chưa cập nhật cuộc gọi";
};

const messageStatusLabel = (status?: MessageStatus | null) => {
  if (status === "SENT") return "Đã nhắn tin";
  if (status === "NOT_SENT") return "Chưa nhắn tin";
  return "";
};

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [note, setNote] = useState("");
  const [result, setResult] = useState("");
  const [callStatus, setCallStatus] = useState<ConsultationCallStatus>("CALLED");
  const [messageStatus, setMessageStatus] = useState<MessageStatus>("SENT");
  const [noMessageReason, setNoMessageReason] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [deadline, setDeadline] = useState(toDatetimeLocal(new Date()));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ customer: CustomerDetail }>(`/customers/${id}`);
      const next = data.customer;
      setCustomer(next);
      setEditForm({
        name: next.name || "",
        companyHead: next.companyHead || "",
        phone: next.phone || "",
        address: next.address || "",
        city: next.city || "",
        status: next.status,
        revenue: String(revenueValue(next.revenue))
      });
    } catch (caught) {
      setError(describeError(caught, "Không tải được khách hàng"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setUser(getStoredUser());
    load();
  }, [load]);

  const isAdmin = user?.role === "ADMIN";
  const isStaff = user?.role === "STAFF";
  const canWork = useMemo(() => {
    if (!customer || !user) return false;
    return user.role === "ADMIN" || customer.ownerId === user.id;
  }, [customer, user]);

  const claim = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await apiFetch<{ customer: CustomerDetail }>(`/customers/${id}/claim`, { method: "POST" });
      const ownerName = data.customer.owner?.name || "nhân viên hiện tại";
      setMessage(`Đã nhận chăm sóc: ${ownerName}`);
      await load();
    } catch (caught) {
      setError(describeError(caught, "Không thể nhận chăm sóc"));
    } finally {
      setBusy(false);
    }
  };

  const release = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiFetch(`/customers/${id}/release`, { method: "POST" });
      setMessage("Đã trả khách về kho chung.");
      await load();
    } catch (caught) {
      setError(describeError(caught, "Không thể trả khách về kho chung"));
    } finally {
      setBusy(false);
    }
  };

  const saveAdminData = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiFetch(`/customers/${id}`, {
        method: "PUT",
        json: {
          ...editForm,
          revenue: Number(editForm.revenue || 0)
        }
      });
      setMessage("Đã cập nhật dữ liệu khách hàng.");
      await load();
    } catch (caught) {
      setError(describeError(caught, "Không thể cập nhật dữ liệu"));
    } finally {
      setBusy(false);
    }
  };

  const addInteraction = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiFetch(`/customers/${id}/interactions`, {
        method: "POST",
        json: {
          note,
          result: result || null,
          status: isStaff ? undefined : editForm.status,
          callStatus: isStaff ? callStatus : null,
          messageStatus: isStaff && callStatus === "CALLED" ? messageStatus : null,
          noMessageReason: isStaff && callStatus === "CALLED" && messageStatus === "NOT_SENT" ? noMessageReason : null
        }
      });
      setNote("");
      setResult("");
      setNoMessageReason("");
      setMessage(isStaff ? "Đã lưu thông tin tư vấn khách hàng." : "Đã lưu ghi chú chăm sóc.");
      await load();
    } catch (caught) {
      setError(describeError(caught, "Không thể thêm ghi chú"));
    } finally {
      setBusy(false);
    }
  };

  const createTask = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiFetch("/tasks", {
        method: "POST",
        json: { customerId: id, title: taskTitle, deadline }
      });
      setTaskTitle("");
      setMessage("Đã tạo lịch gọi lại.");
      await load();
    } catch (caught) {
      setError(describeError(caught, "Không thể tạo công việc"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <PageHeading
        title={customer?.name || "Khách hàng"}
        subtitle={isStaff ? "Cập nhật kết quả tư vấn: chưa gọi được, gọi được, đã nhắn tin hoặc lý do chưa nhắn tin." : "Quản trị viên cập nhật dữ liệu công ty, người phụ trách, trạng thái và doanh thu."}
      />

      {error ? <ErrorAlert className="mb-4">{error}</ErrorAlert> : null}
      {message ? <SuccessAlert className="mb-4">{message}</SuccessAlert> : null}

      {loading || !customer ? (
        <div className="glass-card p-4 text-sm text-slate-400">Đang tải dữ liệu...</div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="space-y-5">
            <GlassCard>
              <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
                <Info label="Tên công ty" value={customer.name || "-"} />
                <Info label="Người đứng đầu công ty" value={customer.companyHead || "-"} />
                <Info label="Số điện thoại" value={customer.phone || "-"} />
                <Info label="Địa điểm" value={customer.address || "-"} />
                <Info label="Thành phố" value={customer.city || "-"} />
                <Info label="Lô dữ liệu" value={customer.importHistory?.importName || customer.importHistory?.filename || "-"} />
                <Info label="Người phụ trách" value={customer.owner?.name ? `Đã nhận: ${customer.owner.name}` : "Chưa có"} />
                {isAdmin ? <Info label="Doanh thu" value={currencyFormat.format(revenueValue(customer.revenue))} /> : null}
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Trạng thái</div>
                  <StatusBadge status={customer.status} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-cyan-300/10 px-4 py-3">
                {isStaff && !customer.ownerId ? (
                  <NeonButton type="button" variant="success" disabled={busy} onClick={claim} className="h-9">
                    <UserPlus className="h-4 w-4" aria-hidden="true" />
                    Nhận dữ liệu
                  </NeonButton>
                ) : null}
                {isAdmin && customer.ownerId ? (
                  <NeonButton type="button" variant="secondary" disabled={busy} onClick={release} className="h-9">
                    <UserMinus className="h-4 w-4" aria-hidden="true" />
                    Trả về kho chung
                  </NeonButton>
                ) : null}
                {isStaff && customer.ownerId && !canWork ? (
                  <span className="rounded-full border border-amber-300/[0.35] bg-amber-300/[0.12] px-3 py-1 text-sm text-amber-100">Dữ liệu này đang được nhân viên khác chăm sóc.</span>
                ) : null}
              </div>
            </GlassCard>

            <GlassCard>
              <div className="border-b border-cyan-300/10 px-4 py-3">
                <h2 className="text-base font-semibold text-white">Lịch sử chăm sóc</h2>
              </div>
              <div className="divide-y divide-cyan-300/10">
                {customer.interactions.length ? (
                  customer.interactions.map((interaction) => (
                    <div key={interaction.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium text-white">{interaction.user.name}</div>
                        <div className="text-xs text-slate-400">{new Date(interaction.createdAt).toLocaleString("vi-VN")}</div>
                      </div>
                      <p className="mt-1 text-sm text-slate-300">{interaction.note}</p>
                      <ConsultationMeta interaction={interaction} />
                      {interaction.result ? <div className="mt-1 text-xs text-slate-400">Kết quả: {interaction.result}</div> : null}
                      {interaction.callHistoryImage ? (
                        <a href={interaction.callHistoryImage} target="_blank" rel="noreferrer" className="mt-3 block max-w-xs">
                          <img src={interaction.callHistoryImage} alt="Ảnh lịch sử cuộc gọi" className="max-h-52 w-full rounded-lg border border-cyan-300/[0.18] object-cover" />
                          <span className="mt-1 block text-xs font-semibold text-cyan-100">Mở ảnh lịch sử cuộc gọi</span>
                        </a>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-slate-400">Chưa có tương tác.</div>
                )}
              </div>
            </GlassCard>

            {isAdmin ? (
              <GlassCard>
                <div className="border-b border-cyan-300/10 px-4 py-3">
                  <h2 className="text-base font-semibold text-white">Công việc</h2>
                </div>
                <div className="divide-y divide-cyan-300/10">
                  {customer.tasks.length ? (
                    customer.tasks.map((task) => (
                      <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                        <div>
                          <div className="font-medium text-white">{task.title}</div>
                          <div className="text-xs text-slate-400">{new Date(task.deadline).toLocaleString("vi-VN")}</div>
                        </div>
                        <StatusBadge status={task.status} />
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-slate-400">Chưa có công việc.</div>
                  )}
                </div>
              </GlassCard>
            ) : null}
          </div>

          <aside className="space-y-5">
            {isAdmin ? (
              <form onSubmit={saveAdminData} className="glass-card p-4">
                <h2 className="mb-3 text-base font-semibold text-white">Cập nhật dữ liệu</h2>
                <Field label="Tên công ty" value={editForm.name} onChange={(value) => setEditForm((old) => ({ ...old, name: value }))} />
                <Field label="Người đứng đầu công ty" value={editForm.companyHead} onChange={(value) => setEditForm((old) => ({ ...old, companyHead: value }))} />
                <Field label="Số điện thoại" value={editForm.phone} onChange={(value) => setEditForm((old) => ({ ...old, phone: value }))} />
                <Field label="Địa điểm" value={editForm.address} onChange={(value) => setEditForm((old) => ({ ...old, address: value }))} />
                <Field label="Thành phố" value={editForm.city} onChange={(value) => setEditForm((old) => ({ ...old, city: value }))} />
                <Field label="Doanh thu" type="number" value={editForm.revenue} onChange={(value) => setEditForm((old) => ({ ...old, revenue: value }))} />
                <label className="mb-3 block">
                  <span className="mb-1 block text-sm font-medium text-slate-300">Trạng thái</span>
                  <Select value={editForm.status} onChange={(event) => setEditForm((old) => ({ ...old, status: event.target.value as CustomerStatus }))}>
                    {customerStatuses.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </Select>
                </label>
                <NeonButton type="submit" disabled={busy} className="w-full">
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Lưu dữ liệu
                </NeonButton>
              </form>
            ) : (
              <GlassCard className="p-4">
                <h2 className="mb-3 text-base font-semibold text-white">Trạng thái tư vấn</h2>
                {!customer.ownerId ? (
                  <div className="text-sm leading-6 text-slate-400">Nhận dữ liệu trước khi cập nhật tư vấn.</div>
                ) : (
                  <div className="text-sm leading-6 text-slate-400">Cập nhật chi tiết trong biểu mẫu ghi chú tư vấn bên dưới.</div>
                )}
              </GlassCard>
            )}

            <form onSubmit={addInteraction} className="glass-card p-4">
              <h2 className="mb-3 text-base font-semibold text-white">{isStaff ? "Ghi chú tư vấn" : "Ghi chú chăm sóc"}</h2>
              {isStaff ? (
                <div className="mb-3 space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-300">Tình trạng cuộc gọi</span>
                    <Select value={callStatus} disabled={!canWork} onChange={(event) => setCallStatus(event.target.value as ConsultationCallStatus)}>
                      <option value="NOT_REACHED">Chưa gọi được</option>
                      <option value="CALLED">Gọi được</option>
                    </Select>
                  </label>

                  {callStatus === "CALLED" ? (
                    <>
                      <label className="block">
                        <span className="mb-1 block text-sm font-medium text-slate-300">Tin nhắn sau khi gọi</span>
                        <Select value={messageStatus} disabled={!canWork} onChange={(event) => setMessageStatus(event.target.value as MessageStatus)}>
                          <option value="SENT">Đã nhắn tin</option>
                          <option value="NOT_SENT">Chưa nhắn tin</option>
                        </Select>
                      </label>

                      {messageStatus === "NOT_SENT" ? (
                        <label className="block">
                          <span className="mb-1 block text-sm font-medium text-slate-300">Lý do chưa nhắn tin</span>
                          <Input value={noMessageReason} disabled={!canWork} required onChange={(event) => setNoMessageReason(event.target.value)} placeholder="Ví dụ: khách không dùng Zalo, khách hẹn nhắn sau..." />
                        </label>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}
              <textarea value={note} disabled={!canWork} onChange={(event) => setNote(event.target.value)} required rows={4} className="neon-field min-h-28 w-full px-3 py-2" placeholder={isStaff ? "Nội dung tư vấn" : "Nội dung chăm sóc"} />
              <Input value={result} disabled={!canWork} onChange={(event) => setResult(event.target.value)} className="mt-3" placeholder="Kết quả chi tiết" />
              <NeonButton type="submit" variant="success" disabled={!canWork || busy} className="mt-3 h-9 w-full">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Lưu ghi chú
              </NeonButton>
            </form>

            {isAdmin ? (
              <form onSubmit={createTask} className="glass-card p-4">
                <h2 className="mb-3 text-base font-semibold text-white">Tạo lịch gọi lại</h2>
                <Input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} required placeholder="Tiêu đề công việc" />
                <Input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} required className="mt-3" />
                <NeonButton type="submit" disabled={busy} className="mt-3 h-9 w-full border-amber-300/[0.45] bg-amber-400/[0.14] text-amber-50 hover:bg-amber-400/[0.22]">
                  <Clock3 className="h-4 w-4" aria-hidden="true" />
                  Tạo công việc
                </NeonButton>
              </form>
            ) : null}
          </aside>
        </div>
      )}
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm font-medium text-slate-300">{label}</span>
      <Input required={label === "Tên công ty"} value={value} type={type} min={type === "number" ? 0 : undefined} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ConsultationMeta({ interaction }: { interaction: CustomerDetail["interactions"][number] }) {
  if (!interaction.callStatus) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2 text-xs">
      <span className="rounded-full border border-cyan-300/[0.28] bg-cyan-300/[0.10] px-2 py-1 font-semibold text-cyan-100">
        {callStatusLabel(interaction.callStatus)}
      </span>
      {interaction.messageStatus ? (
        <span className="rounded-full border border-emerald-300/[0.28] bg-emerald-300/[0.10] px-2 py-1 font-semibold text-emerald-100">
          {messageStatusLabel(interaction.messageStatus)}
        </span>
      ) : null}
      {interaction.noMessageReason ? (
        <span className="rounded-full border border-amber-300/[0.28] bg-amber-300/[0.10] px-2 py-1 font-semibold text-amber-100">
          Lý do: {interaction.noMessageReason}
        </span>
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="break-words text-sm font-medium text-white">{value}</div>
    </div>
  );
}
