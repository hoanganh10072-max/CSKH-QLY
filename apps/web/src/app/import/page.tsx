"use client";

import { FileSpreadsheet, Image as ImageIcon, Link2, ListFilter, PhoneCall, RefreshCcw, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ErrorAlert, SuccessAlert, WarningAlert } from "@/components/alert";
import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/UI/Badge";
import { GlassCard } from "@/components/UI/GlassCard";
import { Input } from "@/components/UI/Input";
import { Modal } from "@/components/UI/Modal";
import { NeonButton } from "@/components/UI/NeonButton";
import { GlassTable, TableBody, TableHead, TableRow, Td, Th } from "@/components/UI/Table";
import { apiFetch, describeError, getStoredUser } from "@/lib/api";
import { notifyDataChanged, useLiveRefresh } from "@/lib/live-sync";
import type { ConsultationCallStatus, CustomerStatus, MessageStatus, SessionUser } from "@/lib/types";

type ImportResponse = {
  history: {
    id: string;
    importName?: string | null;
    filename: string;
  };
  totalRows: number;
  successRows: number;
  duplicateRows: number;
  failedRows: number;
  errors: Array<{ sheet?: string; row: number; message: string }>;
};

type ImportPreviewResponse = {
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  duplicateInFileRows: number;
  duplicateInSystemRows: number;
  readyRows: number;
  failedRows: number;
  errors: Array<{ sheet?: string; row: number; message: string }>;
};

type ImportBatch = {
  id: string;
  importName: string;
  filename: string;
  totalRows: number;
  successRows: number;
  duplicateRows: number;
  failedRows: number;
  totalPhones: number;
  calledCount: number;
  uncalledCount: number;
  createdAt: string;
  creator?: { id: string; name: string; email: string } | null;
  phones: Array<{
    customerId: string;
    companyName: string;
    companyHead?: string | null;
    location?: string | null;
    phone: string;
    city?: string | null;
    customerStatus: CustomerStatus;
    owner?: { id: string; name: string; email: string } | null;
    called: boolean;
    callStatus?: ConsultationCallStatus | null;
    messageStatus?: MessageStatus | null;
    noMessageReason?: string | null;
    callHistoryImage?: string | null;
    calledAt?: string | null;
    calledBy?: { id: string; name: string } | null;
  }>;
};

type ImportProgressResponse = {
  imports: ImportBatch[];
};

type ImportCallFilter = "all" | "called" | "uncalled";

const callLabel = (called: boolean, callStatus?: ConsultationCallStatus | null, messageStatus?: MessageStatus | null) => {
  if (!called) return "Chưa gọi";
  if (callStatus === "NOT_REACHED") return "Đã gọi, chưa gọi được";
  if (callStatus === "CALLED" && messageStatus === "SENT") return "Gọi được, đã nhắn tin";
  if (callStatus === "CALLED" && messageStatus === "NOT_SENT") return "Gọi được, chưa nhắn tin";
  if (callStatus === "CALLED") return "Gọi được";
  return "Đã gọi";
};

const importFromFile = async (file: File, importName: string) => {
  const body = new FormData();
  body.append("file", file);
  body.append("importName", importName);
  return apiFetch<ImportResponse>("/customers/import", { method: "POST", body });
};

const previewFromFile = async (file: File) => {
  const body = new FormData();
  body.append("file", file);
  return apiFetch<ImportPreviewResponse>("/customers/import-preview", { method: "POST", body });
};

const formatImportError = (item: { sheet?: string; row: number; message: string }) =>
  `${item.sheet ? `Trang "${item.sheet}" - ` : ""}Dòng ${item.row}: ${item.message}`;

export default function ImportPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [importName, setImportName] = useState("");
  const [inputMode, setInputMode] = useState<"link" | "file">("link");
  const [sourceUrl, setSourceUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [previewSignature, setPreviewSignature] = useState("");
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [imports, setImports] = useState<ImportBatch[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [deletingImportId, setDeletingImportId] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  const currentSourceSignature =
    inputMode === "link"
      ? `link:${sourceUrl.trim()}`
      : `file:${file?.name || ""}:${file?.size || 0}:${file?.lastModified || 0}`;
  const sourceReady = inputMode === "link" ? Boolean(sourceUrl.trim()) : Boolean(file);
  const isFiltered = Boolean(preview && previewSignature === currentSourceSignature);
  const canImport =
    Boolean(importName.trim()) &&
    sourceReady &&
    isFiltered &&
    (preview?.readyRows ?? 0) > 0 &&
    !loading &&
    !filtering;

  const clearPreview = () => {
    setPreview(null);
    setPreviewSignature("");
  };

  const loadProgress = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoadingProgress(true);
    if (!silent) setError("");
    try {
      const data = await apiFetch<ImportProgressResponse>("/customers/imports");
      setImports(data.imports);
      return data.imports;
    } catch (caught) {
      if (!silent) setError(describeError(caught, "Không tải được tiến trình dữ liệu"));
      return [];
    } finally {
      if (!silent) setLoadingProgress(false);
    }
  };

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);
    if (stored?.role === "ADMIN") {
      loadProgress();
    }
  }, []);

  useLiveRefresh(async () => { await loadProgress({ silent: true }); }, {
    enabled: user?.role === "ADMIN",
    intervalMs: 10000,
    areas: ["imports", "customers", "interactions"]
  });

  const deleteImportBatch = async (item: ImportBatch) => {
    const confirmed = window.confirm(`Xóa lô "${item.importName}" và toàn bộ ${item.totalPhones} khách hàng thuộc lô này?`);
    if (!confirmed) return;

    setDeletingImportId(item.id);
    setError("");
    setMessage("");
    try {
      const data = await apiFetch<{ deletedImportName: string; deletedCustomers: number }>(`/customers/imports/${item.id}`, {
        method: "DELETE"
      });
      setImports((current) => current.filter((importItem) => importItem.id !== item.id));
      setMessage(`Đã xóa lô "${data.deletedImportName}" và ${data.deletedCustomers} khách hàng thuộc lô.`);
      notifyDataChanged({ area: "imports", source: "delete-import" });
      void loadProgress({ silent: true });
    } catch (caught) {
      setError(describeError(caught, "Không thể xóa lô dữ liệu"));
    } finally {
      setDeletingImportId("");
    }
  };

  const filterData = async () => {
    const linkMode = inputMode === "link";
    if (linkMode && !sourceUrl.trim()) return;
    if (!linkMode && !file) return;

    setFiltering(true);
    setError("");
    setMessage("");
    setResult(null);
    setShowErrors(false);
    clearPreview();

    const signature = currentSourceSignature;

    try {
      const data = linkMode
        ? await apiFetch<ImportPreviewResponse>("/customers/import-link-preview", {
          method: "POST",
          json: { sourceUrl }
        })
        : await previewFromFile(file as File);

      setPreview(data);
      setPreviewSignature(signature);
      setMessage(`Đã lọc dữ liệu: còn ${data.readyRows} số điện thoại mới có thể nhập.`);
    } catch (caught) {
      setError(describeError(caught, "Không thể lọc dữ liệu"));
    } finally {
      setFiltering(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const linkMode = inputMode === "link";
    if (linkMode && !sourceUrl.trim()) return;
    if (!linkMode && !file) return;
    if (!isFiltered) {
      setError("Cần bấm Lọc dữ liệu trước khi nhập dữ liệu.");
      return;
    }
    if ((preview?.readyRows ?? 0) <= 0) {
      setError("Không có số điện thoại mới để nhập sau khi lọc dữ liệu.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setShowErrors(false);

    try {
      const data = linkMode
        ? await apiFetch<ImportResponse>("/customers/import-link", {
          method: "POST",
          json: {
            importName,
            sourceUrl
          }
        })
        : await importFromFile(file as File, importName);
      setResult(data);
      setImportName("");
      setSourceUrl("");
      setFile(null);
      clearPreview();
      notifyDataChanged({ area: "imports", source: "submit-import" });
      void loadProgress({ silent: true });
    } catch (caught) {
      setError(describeError(caught, "Nhập dữ liệu thất bại"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <PageHeading title="Nhập dữ liệu" subtitle="Dán link Google Drive/Google Sheet hoặc tải tệp .xlsx. Hệ thống tự đọc toàn bộ sheet và chỉ lấy tên công ty, người đứng đầu, địa điểm, số điện thoại, thành phố." />

      {!user ? (
        <div className="glass-card p-4 text-sm text-slate-400">Đang tải quyền truy cập...</div>
      ) : user.role !== "ADMIN" ? (
        <WarningAlert>Chỉ quản trị viên được nhập dữ liệu.</WarningAlert>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <form onSubmit={submit} className="glass-card p-4">
              <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-cyan-300/[0.16] bg-cyan-300/[0.06] p-1">
                <button
                  type="button"
                  onClick={() => {
                    setInputMode("link");
                    clearPreview();
                    setResult(null);
                    setError("");
                  }}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold transition focus-ring ${inputMode === "link" ? "bg-cyan-300/[0.16] text-cyan-50 shadow-neon" : "text-slate-300 hover:bg-white/[0.06] hover:text-white"}`}
                >
                  <Link2 className="h-4 w-4" aria-hidden="true" />
                  Nhập bằng link
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInputMode("file");
                    clearPreview();
                    setResult(null);
                    setError("");
                  }}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold transition focus-ring ${inputMode === "file" ? "bg-cyan-300/[0.16] text-cyan-50 shadow-neon" : "text-slate-300 hover:bg-white/[0.06] hover:text-white"}`}
                >
                  <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                  Tải tệp .xlsx
                </button>
              </div>
              <label className="mb-4 block">
                <span className="mb-1 block text-sm font-medium text-slate-300">Tên lô dữ liệu</span>
                <Input
                  value={importName}
                  onChange={(event) => setImportName(event.target.value)}
                  required
                  placeholder="Ví dụ: Data doanh nghiệp Hà Nội tháng 08"
                />
              </label>
              {inputMode === "link" ? (
                <label className="block rounded-lg border border-dashed border-cyan-300/[0.28] bg-cyan-300/[0.05] p-4">
                  <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                    <Link2 className="h-4 w-4 text-brand" aria-hidden="true" />
                    Link Google Drive hoặc Google Sheet
                  </span>
                  <Input
                    type="url"
                    value={sourceUrl}
                    onChange={(event) => {
                      setSourceUrl(event.target.value);
                      clearPreview();
                      setResult(null);
                    }}
                    placeholder="https://docs.google.com/spreadsheets/d/... hoặc link Drive .xlsx"
                  />
                  <span className="mt-2 block text-xs leading-5 text-slate-400">
                    File cần bật quyền xem bằng liên kết. Hệ thống tự nhập toàn bộ sheet, không cần chọn sheet.
                  </span>
                </label>
              ) : (
                <label className="flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-cyan-300/[0.28] bg-cyan-300/[0.05] px-4 py-8 text-center transition hover:border-cyan-300/[0.55] hover:bg-cyan-300/[0.09] hover:shadow-glow">
                  <span className="grid h-16 w-16 place-items-center rounded-lg border border-cyan-300/[0.28] bg-cyan-300/[0.12] text-cyan-100 shadow-neon">
                    <FileSpreadsheet className="h-8 w-8" aria-hidden="true" />
                  </span>
                  <span className="mt-4 text-sm font-semibold text-white">{file ? file.name : "Chọn tệp bảng tính .xlsx"}</span>
                  <span className="mt-1 text-xs text-slate-400">Hệ thống đọc toàn bộ sheet và chỉ lấy các cột cần thiết</span>
                  <input
                    type="file"
                    accept=".xlsx"
                    className="sr-only"
                    onChange={(event) => {
                      setFile(event.target.files?.[0] || null);
                      clearPreview();
                      setResult(null);
                    }}
                  />
                </label>
              )}
              {preview ? (
                <div className="mt-4 rounded-lg border border-cyan-300/[0.20] bg-cyan-300/[0.06] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-white">Kết quả lọc dữ liệu</div>
                    <Badge tone={preview.readyRows > 0 ? "green" : "amber"}>
                      Sẵn sàng nhập: {preview.readyRows}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2">
                    <Row label="Tổng dòng" value={preview.totalRows} tone="cyan" />
                    <Row label="Dòng hợp lệ" value={preview.validRows} tone="green" />
                    <Row label="Trùng trong file" value={preview.duplicateInFileRows} tone="amber" />
                    <Row label="Đã có trong hệ thống" value={preview.duplicateInSystemRows} tone="amber" />
                    <Row label="Số mới sẽ nhập" value={preview.readyRows} tone="green" />
                    <Row label="Lỗi dữ liệu" value={preview.failedRows} tone="rose" />
                  </div>
                  {preview.errors.length ? (
                    <div className="mt-3 rounded-lg border border-amber-300/[0.28] bg-amber-300/[0.10] p-3 text-xs leading-5 text-amber-100">
                      {preview.errors.slice(0, 5).map((item) => (
                        <div key={`preview-${item.sheet || "sheet"}-${item.row}-${item.message}`}>{formatImportError(item)}</div>
                      ))}
                      {preview.errors.length > 5 ? <div>Và {preview.errors.length - 5} lỗi khác.</div> : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {error ? <ErrorAlert className="mt-3">{error}</ErrorAlert> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <NeonButton type="button" variant="secondary" disabled={!sourceReady || filtering || loading} onClick={filterData}>
                  <ListFilter className="h-4 w-4" aria-hidden="true" />
                  {filtering ? "Đang lọc..." : "Lọc dữ liệu"}
                </NeonButton>
                <NeonButton disabled={!canImport}>
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  {loading ? "Đang nhập..." : inputMode === "link" ? "Nhập dữ liệu từ link" : "Nhập dữ liệu từ tệp"}
                </NeonButton>
              </div>
            </form>

            <GlassCard className="p-4">
              <h2 className="text-base font-semibold text-white">Kết quả</h2>
              {result ? (
                <div className="mt-3 space-y-3 text-sm">
                  <div className="rounded-lg border border-cyan-300/[0.14] bg-cyan-300/[0.06] px-3 py-2">
                    <div className="text-xs text-slate-400">Lô dữ liệu</div>
                    <div className="mt-1 font-semibold text-white">{result.history.importName || result.history.filename}</div>
                  </div>
                  <Row label="Tổng dòng" value={result.totalRows} tone="cyan" />
                  <Row label="Thành công" value={result.successRows} tone="green" />
                  <Row label="Trùng lặp" value={result.duplicateRows} tone="amber" />
                  <Row label="Lỗi dữ liệu" value={result.failedRows} tone="rose" />
                  {result.errors.length ? (
                    <div className="rounded-lg border border-amber-300/[0.32] bg-amber-300/[0.10] p-3 leading-6 text-amber-100">
                      {result.errors.map((item) => (
                        <div key={`${item.sheet || "sheet"}-${item.row}-${item.message}`}>{formatImportError(item)}</div>
                      ))}
                      <NeonButton type="button" variant="secondary" className="mt-3 h-9" onClick={() => setShowErrors(true)}>
                        Xem bảng lỗi
                      </NeonButton>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-400">Chưa có tệp nào được nhập trong phiên này.</p>
              )}
            </GlassCard>
          </div>

          {message ? <SuccessAlert>{message}</SuccessAlert> : null}

          <ImportProgressPanel
            imports={imports}
            loading={loadingProgress}
            deletingImportId={deletingImportId}
            onRefresh={() => loadProgress()}
            onDelete={deleteImportBatch}
          />

          <Modal open={showErrors} title="Chi tiết lỗi nhập dữ liệu" onClose={() => setShowErrors(false)}>
            <div className="max-h-[60vh] overflow-auto rounded-lg border border-amber-300/[0.24] bg-amber-300/[0.08] p-3 text-sm leading-6 text-amber-100">
              {result?.errors.map((item) => (
                <div key={`modal-${item.sheet || "sheet"}-${item.row}-${item.message}`}>{formatImportError(item)}</div>
              ))}
            </div>
          </Modal>
        </div>
      )}
    </AppShell>
  );
}

function ImportProgressPanel({
  imports,
  loading,
  deletingImportId,
  onRefresh,
  onDelete
}: {
  imports: ImportBatch[];
  loading: boolean;
  deletingImportId: string;
  onRefresh: () => void;
  onDelete: (item: ImportBatch) => void;
}) {
  const [filters, setFilters] = useState<Record<string, ImportCallFilter>>({});

  return (
    <GlassCard>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-300/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <PhoneCall className="h-4 w-4 text-brand" aria-hidden="true" />
          <h2 className="text-base font-semibold text-white">Tiến trình gọi theo lô dữ liệu</h2>
        </div>
        <NeonButton type="button" variant="secondary" disabled={loading} className="h-9" onClick={() => onRefresh()}>
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          Tải lại
        </NeonButton>
      </div>

      {loading && !imports.length ? (
        <div className="p-4 text-sm text-slate-400">Đang tải tiến trình...</div>
      ) : imports.length ? (
        <div className="divide-y divide-cyan-300/10">
          {imports.map((item) => {
            const filter = filters[item.id] || "all";
            const filteredPhones = item.phones.filter((phone) => {
              if (filter === "called") return phone.called;
              if (filter === "uncalled") return !phone.called;
              return true;
            });

            return (
            <section key={item.id} className="p-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">{item.importName}</h3>
                  <div className="mt-1 text-xs text-slate-400">
                    Tệp gốc: {item.filename} • Nhập lúc {new Date(item.createdAt).toLocaleString("vi-VN")}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Badge tone="cyan">Tổng số: {item.totalPhones}</Badge>
                  <Badge tone="green">Đã gọi: {item.calledCount}</Badge>
                  <Badge tone="amber">Còn lại: {item.uncalledCount}</Badge>
                  {item.failedRows ? <Badge tone="rose">Lỗi: {item.failedRows}</Badge> : null}
                  <NeonButton
                    type="button"
                    variant="danger"
                    className="h-8 px-3 text-xs"
                    disabled={deletingImportId === item.id}
                    onClick={() => onDelete(item)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {deletingImportId === item.id ? "Đang xóa" : "Xóa lô"}
                  </NeonButton>
                </div>
              </div>

              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-cyan-300/[0.12] bg-cyan-300/[0.04] p-2">
                <span className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Bộ lọc</span>
                {([
                  { value: "all", label: `Tất cả ${item.totalPhones}` },
                  { value: "called", label: `Đã gọi ${item.calledCount}` },
                  { value: "uncalled", label: `Chưa gọi ${item.uncalledCount}` }
                ] as Array<{ value: ImportCallFilter; label: string }>).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFilters((current) => ({ ...current, [item.id]: option.value }))}
                    className={`inline-flex h-8 items-center rounded-lg border px-3 text-xs font-semibold transition focus-ring ${
                      filter === option.value
                        ? "border-cyan-300/[0.45] bg-cyan-300/[0.14] text-cyan-50 shadow-neon"
                        : "border-white/[0.12] bg-white/[0.05] text-slate-300 hover:border-cyan-300/[0.28] hover:text-white"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="max-h-96 overflow-auto rounded-lg border border-cyan-300/[0.12]">
                <GlassTable className="border-0">
                  <TableHead>
                    <tr>
                      <Th>Công ty</Th>
                      <Th>Người đứng đầu</Th>
                      <Th>Số điện thoại</Th>
                      <Th>Người phụ trách</Th>
                      <Th>Tình trạng khách</Th>
                      <Th>Trạng thái gọi</Th>
                      <Th>Ảnh minh chứng</Th>
                    </tr>
                  </TableHead>
                  <TableBody>
                    {filteredPhones.length ? filteredPhones.map((phone) => (
                      <TableRow key={phone.customerId}>
                        <Td>
                          <Link href={`/customers/${phone.customerId}`} className="font-semibold text-cyan-50 hover:text-cyan-200">
                            {phone.companyName}
                          </Link>
                          <div className="mt-1 text-xs text-slate-500">{phone.location || "-"}</div>
                        </Td>
                        <Td className="text-slate-300">{phone.companyHead || "-"}</Td>
                        <Td className="font-semibold text-white">{phone.phone}</Td>
                        <Td>
                          {phone.owner ? (
                            <div>
                              <div className="font-semibold text-white">{phone.owner.name}</div>
                              <div className="text-xs text-slate-500">{phone.owner.email}</div>
                            </div>
                          ) : (
                            <span className="text-slate-400">Chưa có</span>
                          )}
                        </Td>
                        <Td><StatusBadge status={phone.customerStatus} /></Td>
                        <Td>
                          <Badge tone={phone.called ? "green" : "amber"}>
                            {callLabel(phone.called, phone.callStatus, phone.messageStatus)}
                          </Badge>
                          {phone.calledAt ? <div className="mt-1 text-xs text-slate-500">{new Date(phone.calledAt).toLocaleString("vi-VN")}</div> : null}
                          {phone.noMessageReason ? <div className="mt-1 max-w-48 text-xs text-amber-100">Lý do chưa nhắn: {phone.noMessageReason}</div> : null}
                        </Td>
                        <Td>
                          {phone.callHistoryImage ? (
                            <a href={phone.callHistoryImage} target="_blank" rel="noreferrer" className="group inline-flex items-center gap-2">
                              <img src={phone.callHistoryImage} alt="Ảnh minh chứng cuộc gọi" className="h-12 w-16 rounded-lg border border-cyan-300/[0.18] object-cover transition group-hover:border-cyan-300/[0.45]" />
                              <span className="text-xs font-semibold text-cyan-100 group-hover:text-white">Xem</span>
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-2 text-slate-500">
                              <ImageIcon className="h-4 w-4" aria-hidden="true" />
                              Chưa có
                            </span>
                          )}
                        </Td>
                      </TableRow>
                    )) : (
                      <tr><Td className="py-6 text-slate-400" colSpan={7}>
                        {item.phones.length ? "Không có số điện thoại phù hợp với bộ lọc." : "Lô dữ liệu này chưa có số điện thoại hợp lệ."}
                      </Td></tr>
                    )}
                  </TableBody>
                </GlassTable>
              </div>
            </section>
          );
          })}
        </div>
      ) : (
        <div className="p-4 text-sm text-slate-400">Chưa có lô dữ liệu nào.</div>
      )}
    </GlassCard>
  );
}

function Row({ label, value, tone }: { label: string; value: number; tone: "cyan" | "green" | "amber" | "rose" }) {
  return (
    <div className="flex items-center justify-between border-b border-cyan-300/10 pb-2">
      <span className="text-slate-300">{label}</span>
      <Badge tone={tone}>{value}</Badge>
    </div>
  );
}
