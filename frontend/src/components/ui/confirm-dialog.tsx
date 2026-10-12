"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Trash2,
  LogOut,
} from "lucide-react";

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary" | "warning" | "success";
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  testId?: string;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  onConfirm,
  onCancel,
  loading = false,
  testId = "confirm-dialog-modal",
}: ConfirmDialogProps) {
  const variantStyles = {
    danger: {
      iconBg: "bg-rose-50 border-rose-200/80 text-rose-600",
      button: "bg-rose-600 hover:bg-rose-700 text-white",
      Icon: Trash2,
    },
    warning: {
      iconBg: "bg-amber-50 border-amber-200/80 text-amber-700",
      button: "bg-zinc-900 hover:bg-zinc-800 text-white",
      Icon: LogOut,
    },
    success: {
      iconBg: "bg-emerald-50 border-emerald-200/80 text-emerald-600",
      button: "bg-emerald-600 hover:bg-emerald-700 text-white",
      Icon: CheckCircle2,
    },
    primary: {
      iconBg: "bg-zinc-100 border-zinc-200/80 text-zinc-800",
      button: "bg-zinc-900 hover:bg-zinc-800 text-white",
      Icon: HelpCircle,
    },
  }[variant];

  const IconComponent = variantStyles.Icon || AlertTriangle;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid={testId}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="fixed inset-0 bg-zinc-950/40 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 460, damping: 34 }}
            className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.12)] border border-zinc-200/90 relative z-10"
          >
            <div className="flex items-start gap-3.5">
              <div
                className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${variantStyles.iconBg}`}
              >
                <IconComponent className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm sm:text-base font-semibold text-zinc-900 tracking-tight">
                  {title}
                </h3>
                <div className="text-xs sm:text-sm text-zinc-600 leading-relaxed mt-1">
                  {description}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 mt-5 border-t border-zinc-100">
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                data-testid="confirm-dialog-cancel"
                className="px-3.5 py-1.5 rounded-lg border border-zinc-200/90 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                data-testid="confirm-dialog-submit"
                className={`px-3.5 py-1.5 rounded-lg font-medium text-xs transition inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-50 ${variantStyles.button}`}
              >
                <span>{loading ? "Processing..." : confirmLabel}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
