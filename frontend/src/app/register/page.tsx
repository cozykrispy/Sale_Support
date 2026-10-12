"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Mail, User, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || "Registration failed");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 1000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to register user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#FAFAFA] bg-subtle-grid px-4 py-12">
      <div className="w-full max-w-[420px]">
        {/* Brand Top Header */}
        <div className="flex items-center justify-between mb-6 px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-zinc-950 text-white flex items-center justify-center font-mono text-xs font-bold tracking-tighter">
              FA
            </div>
            <div>
              <span className="text-sm font-semibold text-zinc-950 tracking-tight">
                Fusion Advantec
              </span>
              <span className="mx-1.5 text-zinc-300">/</span>
              <span className="text-xs font-mono text-zinc-500">
                ONBOARDING
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_12px_32px_rgba(0,0,0,0.04)] p-7 sm:p-8">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-zinc-950 tracking-tight">
              Create Workspace Account
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Provision your Fusion Advantec Sales Support credentials.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 flex items-center gap-2.5 rounded-lg bg-rose-50/80 border border-rose-200 px-3.5 py-2.5 text-xs font-medium text-rose-700"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div
              role="status"
              className="mb-5 flex items-center gap-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200 px-3.5 py-2.5 text-xs font-medium text-emerald-800"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Account created. Redirecting to sign in...</span>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label
                htmlFor="register-username"
                className="block text-xs font-medium text-zinc-700 mb-1.5"
              >
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  id="register-username"
                  type="text"
                  required
                  minLength={3}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full pl-9 pr-3.5 py-2 rounded-lg bg-zinc-50/60 border border-zinc-200 text-sm text-zinc-950 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="register-email"
                className="block text-xs font-medium text-zinc-700 mb-1.5"
              >
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  id="register-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@fusion.co.th"
                  className="w-full pl-9 pr-3.5 py-2 rounded-lg bg-zinc-50/60 border border-zinc-200 text-sm text-zinc-950 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="register-password"
                className="block text-xs font-medium text-zinc-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  id="register-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full pl-9 pr-3.5 py-2 rounded-lg bg-zinc-50/60 border border-zinc-200 text-sm text-zinc-950 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white font-medium text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-2xs"
            >
              <span>{loading ? "Creating account..." : "Create Account"}</span>
              {!loading && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-zinc-100 text-center text-xs text-zinc-500">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-zinc-900 hover:underline"
            >
              Sign in here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
