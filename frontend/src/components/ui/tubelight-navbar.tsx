"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Search,
  Package,
  BarChart3,
  Users,
  LogOut,
  Clock,
  Sparkles,
} from "lucide-react";
import { UserProfile } from "@/lib/api";

export type NavTabId = "search" | "manage" | "analytics";

interface TubelightNavbarProps {
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  activeProductsCount: number;
  user: UserProfile | null;
  expiresAt: string | null;
  onOpenUsersModal: () => void;
  onLogout: () => void;
}

export function TubelightNavbar({
  activeTab,
  onSelectTab,
  activeProductsCount,
  user,
  expiresAt,
  onOpenUsersModal,
  onLogout,
}: TubelightNavbarProps) {
  const navItems: {
    id: NavTabId;
    label: string;
    shortLabel: string;
    testId: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }[] = [
    {
      id: "search",
      label: "Product Search",
      shortLabel: "Search",
      testId: "tab-product-search",
      icon: Search,
    },
    {
      id: "manage",
      label: "Manage Products",
      shortLabel: "Products",
      testId: "tab-manage-products",
      icon: Package,
      badge: activeProductsCount,
    },
    {
      id: "analytics",
      label: "Analytics Dashboard",
      shortLabel: "Analytics",
      testId: "tab-analytics-dashboard",
      icon: BarChart3,
    },
  ];

  return (
    <header className="sticky top-0 z-50 pt-2 sm:pt-3 pb-2 px-2 sm:px-4 pointer-events-none">
      <div className="w-full max-w-7xl mx-auto flex items-center justify-between gap-1.5 sm:gap-2.5 pointer-events-auto bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.02)] rounded-full px-3 sm:px-4 py-1.5 transition-all">
        {/* Left: Clean Minimal Brand Identity */}
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-b from-white to-slate-50 border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-800" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-sm font-semibold text-slate-900 tracking-tight truncate">
              Sales Support Hub
            </h1>
            <span className="hidden xl:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100/90 text-slate-600 border border-slate-200/60">
              Fusion Advantec
            </span>
          </div>
        </div>

        {/* Center: 21st.dev Smooth Sliding Pill Navigation (Pure White, No Blue Line, Full Display No Scrollbar) */}
        <nav
          role="tablist"
          aria-label="Workspace Navigation"
          className="inline-flex items-center bg-slate-100/80 p-1 rounded-full border border-slate-200/70 shadow-inner relative shrink-0"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                data-testid={item.testId}
                onClick={() => onSelectTab(item.id)}
                className={`relative inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-medium transition-colors duration-200 z-10 shrink-0 whitespace-nowrap ${
                  isActive
                    ? "text-slate-950 font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {/* Smooth Animated Sliding White Pill */}
                {isActive && (
                  <motion.span
                    layoutId="active-nav-pill"
                    className="absolute inset-0 rounded-full bg-white shadow-[0_2px_12px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] border border-slate-200/80 -z-10"
                    transition={{
                      type: "spring",
                      stiffness: 420,
                      damping: 34,
                    }}
                  />
                )}

                <Icon
                  className={`w-3.5 h-3.5 transition-colors duration-150 shrink-0 ${
                    isActive ? "text-slate-900" : "text-slate-400"
                  }`}
                />
                <span className="hidden xl:inline whitespace-nowrap">{item.label}</span>
                <span className="inline xl:hidden whitespace-nowrap">{item.shortLabel}</span>
                {typeof item.badge === "number" && (
                  <span
                    className={`inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-mono font-semibold transition-colors duration-150 ${
                      isActive
                        ? "bg-slate-100 text-slate-800 border border-slate-200/80"
                        : "bg-slate-200/70 text-slate-500"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Clean White Session & User Pill Cluster */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* JWT Status Pill (Visible for E2E & Session Verification) */}
          <div className="flex items-center gap-1 sm:gap-1.5 px-2 py-1 rounded-full bg-emerald-50/70 border border-emerald-200/60 text-[10px] sm:text-[11px] font-medium text-emerald-800 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="inline">Protected Route (JWT Active)</span>
            {expiresAt && (
              <span className="hidden 2xl:inline-flex items-center gap-1 text-emerald-700/80 font-mono text-[10px] pl-1 border-l border-emerald-200/80">
                <Clock className="w-2.5 h-2.5" />
                {new Date(expiresAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>

          {/* Team Accounts Trigger (Admin Only for Governance) */}
          {user?.username === "admin" && (
            <button
              type="button"
              onClick={onOpenUsersModal}
              title="Team Accounts"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-950 font-medium text-xs transition shadow-[0_1px_2px_rgba(0,0,0,0.02)] shrink-0"
            >
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline text-[11px]">Team</span>
            </button>
          )}

          {/* Unified User & Logout Capsule */}
          <div className="inline-flex items-center gap-1 pl-1.5 pr-1 py-0.5 sm:py-1 rounded-full bg-slate-100/80 border border-slate-200/70 shrink-0">
            {user && (
              <div className="flex items-center gap-1 pr-0.5">
                <span className="w-5 h-5 rounded-full bg-white border border-slate-200/90 text-slate-800 font-semibold text-[10px] flex items-center justify-center uppercase shadow-2xs">
                  {user.username.slice(0, 2)}
                </span>
                <span className="text-xs font-medium text-slate-700 max-w-[60px] sm:max-w-[80px] truncate hidden md:inline">
                  {user.username}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={onLogout}
              data-testid="logout-button"
              title="Sign out"
              className="inline-flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-full bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200/70 hover:border-rose-200 text-xs font-medium transition shadow-2xs"
            >
              <LogOut className="w-3 h-3" />
              <span className="hidden lg:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
