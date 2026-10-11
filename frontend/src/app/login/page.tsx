"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, User, AlertCircle, Clock, ArrowRight, Terminal } from "lucide-react";
import { API_BASE_URL, AuthTokenResponse, saveAuthSession } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || "Invalid username or password");
      }

      const data: AuthTokenResponse = await response.json();
      saveAuthSession(data);
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const fillDemoUser = () => {
    setUsername("admin");
    setPassword("Admin@1234");
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#FAFAFA] bg-subtle-grid px-4 py-12">
      <div className="w-full max-w-[420px]">
        {/* Brand Top Header */}
        <div className="flex items-center justify-between mb-6 px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-zinc-950 text-white flex items-center justify-center font-mono text-xs font-bold tracking-tighter">
              FA
            </div>
            <div>
              <span className="text-sm font-semibold text-zinc-950 tracking-tight">
                Fusion Advantec
              </span>
              <span className="mx-1.5 text-zinc-300">/</span>
              <span className="text-xs font-mono text-zinc-500">
                SALES_HUB_V2
              </span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-zinc-500 bg-white px-2.5 py-1 rounded-md border border-zinc-200/90 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            AUTH READY
          </span>
        </div>

        {/* Main Auth Surface */}
        <div className="bg-white rounded-xl border border-zinc-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.03)] p-7 sm:p-8">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-zinc-950 tracking-tight">
              Sales Support Hub
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Sign in with your corporate credentials to access catalog &amp; AI intelligence.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 flex items-center gap-2.5 rounded-lg bg-red-50/80 border border-red-200 px-3.5 py-2.5 text-xs font-medium text-red-700"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="login-username"
                className="block text-xs font-medium text-zinc-700 mb-1.5"
              >
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  id="login-username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full pl-9 pr-3.5 py-2 rounded-lg bg-zinc-50/60 border border-zinc-200 text-sm text-zinc-950 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-medium text-zinc-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-9 pr-3.5 py-2 rounded-lg bg-zinc-50/60 border border-zinc-200 text-sm text-zinc-950 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-500 bg-zinc-50 rounded-lg px-3 py-2 border border-zinc-200/80">
              <span className="flex items-center gap-1.5 font-mono text-[11px]">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                JWT TTL: <strong className="text-zinc-800">3600s (1h)</strong>
              </span>
              <button
                type="button"
                onClick={fillDemoUser}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition"
              >
                <Terminal className="w-3 h-3" />
                Fill Demo
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white font-medium text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-2xs"
            >
              <span>{loading ? "Signing in..." : "Sign In"}</span>
              {!loading && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-zinc-100 text-center text-xs text-zinc-500">
            Need workspace access?{" "}
            <Link
              href="/register"
              className="font-semibold text-zinc-900 hover:underline"
            >
              Register new user
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
