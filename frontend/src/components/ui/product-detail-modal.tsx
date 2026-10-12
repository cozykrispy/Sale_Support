"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Package,
  FileText,
  GitBranchPlus,
  Check,
  ExternalLink,
} from "lucide-react";
import {
  Product,
  SuggestedProductResult,
  getCapsuleStyle,
} from "@/lib/api";

interface ProductDetailModalProps {
  isOpen: boolean;
  product: SuggestedProductResult | Product | null;
  onClose: () => void;
}

export function ProductDetailModal({
  isOpen,
  product,
  onClose,
}: ProductDetailModalProps) {
  if (!product) return null;

  const matchScore =
    "match_score" in product ? product.match_score : undefined;
  const reasoning = "reasoning" in product ? product.reasoning : undefined;
  const keyBenefits =
    "key_benefits" in product ? product.key_benefits : undefined;
  const docs = product.supporting_documents || [];
  const crossSells = product.cross_sell_products || [];

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="product-detail-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-zinc-950/45 backdrop-blur-[2px]"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ type: "spring", stiffness: 440, damping: 34 }}
            className="w-full max-w-2xl rounded-2xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.14)] border border-zinc-200/90 overflow-hidden relative z-10 max-h-[88vh] flex flex-col"
          >
            {/* Studio Header with Thumbnail & Taxonomy */}
            <div className="p-5 sm:p-6 border-b border-zinc-100 bg-zinc-50/50 flex items-start justify-between gap-4 shrink-0">
              <div className="flex items-start gap-4 min-w-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-white border border-zinc-200/80 overflow-hidden shrink-0 flex items-center justify-center relative shadow-2xs">
                  <Package className="w-7 h-7 text-zinc-300" />
                  {product.image_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover absolute inset-0"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-zinc-900 text-white">
                      {product.brand}
                    </span>
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${getCapsuleStyle(
                        product.category,
                        "category"
                      )}`}
                    >
                      {product.category}
                    </span>
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${getCapsuleStyle(
                        product.type,
                        "type"
                      )}`}
                    >
                      {product.type}
                    </span>
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${getCapsuleStyle(
                        product.sub_type,
                        "sub_type"
                      )}`}
                    >
                      {product.sub_type}
                    </span>
                    {typeof matchScore === "number" && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 tabular-nums">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {matchScore}% match
                      </span>
                    )}
                  </div>

                  <h2 className="text-base sm:text-lg font-semibold text-zinc-950 tracking-tight leading-snug">
                    {product.name}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                aria-label="Close detail modal"
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-white hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 border border-zinc-200/80 flex items-center justify-center transition shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Specification Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
              {/* Product Specification / Description */}
              <div>
                <h3 className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                  Specification &amp; Overview
                </h3>
                <div className="text-sm text-zinc-700 leading-relaxed bg-zinc-50/70 border border-zinc-200/70 rounded-xl p-4">
                  {product.description || reasoning || "No description provided."}
                </div>
              </div>

              {/* Key Highlights */}
              {keyBenefits && keyBenefits.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                    Key Highlights
                  </h3>
                  <ul className="space-y-2 bg-white border border-zinc-200/80 rounded-xl p-4 text-xs sm:text-sm text-zinc-700">
                    {keyBenefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span className="w-4 h-4 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-2.5 h-2.5 text-emerald-600" />
                        </span>
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Supporting Documents */}
              {docs.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold mb-2 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Supporting Documentation ({docs.length})</span>
                  </h3>
                  <div className="grid grid-cols-1 gap-2">
                    {docs.map((doc, i) => (
                      <div
                        key={i}
                        className="p-3.5 rounded-xl bg-white border border-zinc-200/80 hover:border-zinc-300 transition flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] font-mono font-medium uppercase px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 border border-zinc-200/80 shrink-0">
                              {doc.doc_type}
                            </span>
                            <span className="text-xs sm:text-sm font-semibold text-zinc-900 truncate">
                              {doc.title}
                            </span>
                          </div>
                          {doc.url && doc.url !== "#" && (
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 shrink-0"
                            >
                              <span>Open</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 leading-relaxed">
                          {doc.summary}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cross-selling */}
              {crossSells.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold mb-2 flex items-center gap-1.5">
                    <GitBranchPlus className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Recommended Pairings ({crossSells.length})</span>
                  </h3>
                  <div className="grid grid-cols-1 gap-2">
                    {crossSells.map((cs, i) => (
                      <div
                        key={i}
                        className="p-3.5 rounded-xl bg-zinc-50/70 border border-zinc-200/80 flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs sm:text-sm font-semibold text-zinc-900">
                            {cs.product_name}
                          </span>
                          <span
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${getCapsuleStyle(
                              cs.category,
                              "category"
                            )}`}
                          >
                            {cs.category}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-600 leading-relaxed">
                          {cs.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 bg-zinc-50/80 border-t border-zinc-200/80 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={onClose}
                data-testid="close-detail-modal-btn"
                className="px-4 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium transition"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
