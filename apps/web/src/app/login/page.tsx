"use client";

import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ErrorAlert } from "@/components/alert";
import { GlassCard } from "@/components/UI/GlassCard";
import { Input } from "@/components/UI/Input";
import { NeonButton } from "@/components/UI/NeonButton";
import { apiFetch, describeError, setSession } from "@/lib/api";
import type { SessionUser } from "@/lib/types";

type LoginResponse = {
  token: string;
  user: SessionUser;
};

export default function LoginPage() {
  const router = useRouter();
  const [account, setAccount] = useState("admin");
  const [password, setPassword] = useState("1007");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        json: { account, password }
      });
      setSession(response.token, response.user);
      router.replace("/dashboard");
    } catch (caught) {
      setError(describeError(caught, "Đăng nhập thất bại"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#020817] bg-[radial-gradient(circle_at_0%_12%,_rgba(0,212,255,0.18),_transparent_30%),radial-gradient(circle_at_100%_88%,_rgba(168,85,247,0.16),_transparent_32%),linear-gradient(135deg,#020817_0%,#061426_52%,#081B33_100%)] px-4 py-8 text-slate-100">
      <form onSubmit={submit} className="relative z-10 w-full max-w-md">
        <GlassCard className="p-6">
        <div className="mb-6 border-b border-cyan-300/10 pb-4">
          <div className="mb-3 grid h-12 w-20 place-items-center rounded-lg border border-cyan-300/[0.35] bg-cyan-300/[0.12] text-[11px] font-black text-cyan-50 shadow-neon">MSCILABS</div>
          <h1 className="text-2xl font-semibold text-white">Quản lý MSCILABS</h1>
          <p className="mt-1 text-sm leading-6 text-slate-400">Đăng nhập để quản lý kho dữ liệu khách hàng.</p>
        </div>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-medium text-slate-300">Tài khoản</span>
          <Input value={account} onChange={(event) => setAccount(event.target.value)} autoComplete="username" />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-medium text-slate-300">Mật khẩu</span>
          <Input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
          />
        </label>

        {error ? <ErrorAlert className="mb-4">{error}</ErrorAlert> : null}

        <NeonButton
          type="submit"
          disabled={loading}
          className="w-full"
        >
          <LogIn className="h-4 w-4" aria-hidden="true" />
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </NeonButton>

        <div className="mt-4 rounded-lg border border-cyan-300/[0.15] bg-cyan-300/[0.08] px-3 py-2 text-xs text-slate-300">
          <div>Tài khoản đăng nhập liên hệ admin cấp tài khoản</div>
        </div>
        </GlassCard>
      </form>
    </main>
  );
}
