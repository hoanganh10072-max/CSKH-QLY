"use client";

import { RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { ErrorAlert } from "@/components/alert";
import { NeonButton } from "@/components/UI/NeonButton";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const detail = [
    error.name ? `Tên lỗi: ${error.name}` : null,
    error.message ? `Thông báo: ${error.message}` : null,
    error.digest ? `Mã lỗi: ${error.digest}` : null,
    error.stack ? `Ngăn xếp lỗi:\n${error.stack}` : null
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <main className="grid min-h-screen place-items-center bg-[#020817] px-4 py-8 text-slate-100">
      <div className="glass-card w-full max-w-3xl p-5">
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-white">Ứng dụng gặp lỗi</h1>
          <p className="mt-1 text-sm leading-6 text-slate-400">Thông tin lỗi được hiển thị đầy đủ để dễ xử lý, không bị ẩn sau màn hình trắng.</p>
        </div>
        <ErrorAlert>{detail || "Không có chi tiết lỗi."}</ErrorAlert>
        <NeonButton
          type="button"
          onClick={reset}
          className="mt-4"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Thử lại
        </NeonButton>
      </div>
    </main>
  );
}
