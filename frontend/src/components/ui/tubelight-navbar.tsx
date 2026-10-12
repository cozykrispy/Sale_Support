"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Search,
  Package,
  BarChart3,
  LogOut,
  Command,
} from "lucide-react";
import { UserProfile, clearAuthSession } from "@/lib/api";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export type NavTabId = "search" | "manage" | "analytics";

interface TubelightNavbarProps {
  activeTab?: NavTabId;
  onSelectTab?: (tab: NavTabId) => void;
  activeProductsCount?: number;
  user: UserProfile | null;
  onLogout?: () => void;
}

export function TubelightNavbar({
  activeTab,
  onSelectTab,
  activeProductsCount,
  user,
  onLogout,
}: TubelightNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);

  const resolvedActive: NavTabId =
    activeTab ||
    (pathname?.startsWith("/productmanage")
      ? "manage"
      : pathname?.startsWith("/analyze")
      ? "analytics"
      : "search");

  const navItems: {
    id: NavTabId;
    href: string;
    label: string;
    shortLabel: string;
    testId: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    dotColor: string;
    activePillClass: string;
    activeTextClass: string;
    activeIconClass: string;
    inactiveCapsuleHover: string;
    badgeActiveClass: string;
  }[] = [
    {
      id: "search",
      href: "/home",
      label: "Product Search",
      shortLabel: "Search",
      testId: "tab-product-search",
      icon: Search,
      dotColor: "bg-blue-500",
      activePillClass:
        "bg-blue-50/95 border-blue-200/90 shadow-[0_1px_2px_rgba(37,99,235,0.08)]",
      activeTextClass: "text-blue-950 font-semibold",
      activeIconClass: "text-blue-600",
      inactiveCapsuleHover: "hover:bg-blue-50/40 hover:text-blue-900",
      badgeActiveClass: "bg-blue-600 text-white",
    },
    {
      id: "manage",
      href: "/productmanage",
      label: "Manage Products",
      shortLabel: "Catalog",
      testId: "tab-manage-products",
      icon: Package,
      badge: activeProductsCount,
      dotColor: "bg-violet-500",
      activePillClass:
        "bg-violet-50/95 border-violet-200/90 shadow-[0_1px_2px_rgba(124,58,237,0.08)]",
      activeTextClass: "text-violet-950 font-semibold",
      activeIconClass: "text-violet-600",
      inactiveCapsuleHover: "hover:bg-violet-50/40 hover:text-violet-900",
      badgeActiveClass: "bg-violet-600 text-white",
    },
    {
      id: "analytics",
      href: "/analyze",
      label: "Analytics",
      shortLabel: "Analytics",
      testId: "tab-analytics-dashboard",
      icon: BarChart3,
      dotColor: "bg-emerald-500",
      activePillClass:
        "bg-emerald-50/95 border-emerald-200/90 shadow-[0_1px_2px_rgba(5,150,105,0.08)]",
      activeTextClass: "text-emerald-950 font-semibold",
      activeIconClass: "text-emerald-600",
      inactiveCapsuleHover: "hover:bg-emerald-50/40 hover:text-emerald-900",
      badgeActiveClass: "bg-emerald-600 text-white",
    },
  ];

  const handleConfirmLogout = () => {
    setConfirmLogoutOpen(false);
    if (onLogout) {
      onLogout();
    } else {
      clearAuthSession();
      router.push("/login");
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 pt-2.5 pb-2 px-3 sm:px-6 pointer-events-none">
        <div className="w-full max-w-7xl mx-auto flex items-center justify-between gap-3 pointer-events-auto bg-white/90 backdrop-blur-xl border border-zinc-200/80 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.02)] rounded-2xl px-3.5 py-2 transition-all">
          {/* Left: Brand Identity */}
          <Link
            href="/home"
            className="flex items-center gap-2.5 min-w-0 shrink-0 group"
          >
            <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:bg-zinc-800 transition-colors">
              <Command className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-zinc-900 tracking-tight truncate">
                Sales Support
              </span>
              <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-zinc-100 text-zinc-600 border border-zinc-200/70">
                Fusion Advantec
              </span>
            </div>
          </Link>

          {/* Center: Distinct Color Capsule Navigation (/home, /productmanage, /analyze) */}
          <nav
            role="tablist"
            aria-label="Workspace Navigation"
            className="inline-flex items-center bg-zinc-100/70 p-1 rounded-xl border border-zinc-200/70 relative shrink-0 gap-1"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = resolvedActive === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  data-testid={item.testId}
                  onClick={() => {
                    if (onSelectTab) {
                      onSelectTab(item.id);
                    }
                    router.push(item.href);
                  }}
                  className={`relative inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs transition-all duration-150 z-10 shrink-0 whitespace-nowrap ${
                    isActive
                      ? item.activeTextClass
                      : `text-zinc-600 font-medium ${item.inactiveCapsuleHover}`
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="active-nav-pill"
                      className={`absolute inset-0 rounded-lg border -z-10 ${item.activePillClass}`}
                      transition={{
                        type: "spring",
                        stiffness: 460,
                        damping: 36,
                      }}
                    />
                  )}

                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isActive ? item.dotColor : "bg-zinc-300"
                    }`}
                  />
                  <Icon
                    className={`w-3.5 h-3.5 transition-colors duration-150 shrink-0 ${
                      isActive ? item.activeIconClass : "text-zinc-400"
                    }`}
                  />
                  <span className="hidden sm:inline whitespace-nowrap">
                    {item.label}
                  </span>
                  <span className="inline sm:hidden whitespace-nowrap">
                    {item.shortLabel}
                  </span>
                  {typeof item.badge === "number" && (
                    <span
                      className={`inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-mono font-semibold tabular-nums transition-colors duration-150 ${
                        isActive
                          ? item.badgeActiveClass
                          : "bg-zinc-200/80 text-zinc-600"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right: User & Logout Action */}
          <div className="flex items-center gap-2 shrink-0">
            {user && (
              <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-zinc-50 border border-zinc-200/70">
                <span className="w-5 h-5 rounded-md bg-zinc-900 text-white font-mono font-semibold text-[10px] flex items-center justify-center uppercase">
                  {user.username.slice(0, 2)}
                </span>
                <span className="text-xs font-medium text-zinc-700 max-w-[100px] truncate">
                  {user.username}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setConfirmLogoutOpen(true)}
              data-testid="logout-button"
              title="Sign out"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900 border border-zinc-200/80 text-xs font-medium transition"
            >
              <LogOut className="w-3.5 h-3.5 text-zinc-500" />
              <span className="hidden lg:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <ConfirmDialog
        isOpen={confirmLogoutOpen}
        title="Sign out of workspace"
        description="Are you sure you want to end your current session?"
        confirmLabel="Sign out"
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={handleConfirmLogout}
        onCancel={() => setConfirmLogoutOpen(false)}
        testId="confirm-logout-modal"
      />
    </>
  );
}
