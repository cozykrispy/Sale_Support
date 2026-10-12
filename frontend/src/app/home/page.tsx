"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  SlidersHorizontal,
  Sparkles,
  Zap,
  Package,
  AlertCircle,
  X,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CornerDownLeft,
  RotateCcw,
  History,
  Clock,
  Trash2,
} from "lucide-react";
import {
  apiFetch,
  clearAuthSession,
  getAuthToken,
  getStoredUser,
  getCapsuleStyle,
  Product,
  AISuggestResponse,
  SuggestedProductResult,
  SearchHistoryItem,
  TaxonomyCategory,
  UserProfile,
} from "@/lib/api";
import { TubelightNavbar } from "@/components/ui/tubelight-navbar";
import { TaxonomyCombobox } from "@/components/ui/taxonomy-combobox";
import { ProductDetailModal } from "@/components/ui/product-detail-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const PAGE_SIZE = 10;

export default function HomeSearchPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);

  // Catalog, Taxonomy & Search History State
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [taxonomy, setTaxonomy] = useState<TaxonomyCategory[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  // Search & Mode State
  const [searchMode, setSearchMode] = useState<"quick" | "detailed">("quick");
  const [aiApiAvailable, setAiApiAvailable] = useState<boolean>(true);
  const [customerQuery, setCustomerQuery] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [aiResult, setAiResult] = useState<AISuggestResponse | null>(null);

  // Advance Filter State (Category -> Type -> Sub Type)
  const [showAdvanceFilter, setShowAdvanceFilter] = useState<boolean>(false);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterSubType, setFilterSubType] = useState<string>("");

  // Pagination (3 cols per row, 10 products per page)
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Product Detail Modal on Click
  const [selectedProductModal, setSelectedProductModal] = useState<
    SuggestedProductResult | Product | null
  >(null);

  // Confirmation Dialog for History deletion
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    description: React.ReactNode;
    confirmLabel: string;
    onConfirm: () => Promise<void> | void;
  }>({
    isOpen: false,
    title: "",
    description: "",
    confirmLabel: "Confirm",
    onConfirm: () => {},
  });

  // Notifications
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const skipNextDebounceRef = useRef<boolean>(false);

  const loadHistory = useCallback(async () => {
    try {
      const hist = await apiFetch<SearchHistoryItem[]>("/api/ai/history");
      setSearchHistory(hist);
    } catch {
      // Ignore history fetch errors silently
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    try {
      const [prods, tax, hist] = await Promise.all([
        apiFetch<Product[]>("/api/products"),
        apiFetch<TaxonomyCategory[]>("/api/taxonomy"),
        apiFetch<SearchHistoryItem[]>("/api/ai/history").catch(() => []),
      ]);
      setAllProducts(prods);
      setTaxonomy(tax);
      setSearchHistory(hist);
    } catch (err: unknown) {
      setErrorBanner(
        err instanceof Error ? err.message : "Failed to load catalog data"
      );
    }

    // Check Detailed Search AI API availability
    try {
      const statusRes = await apiFetch<{ available: boolean }>("/api/ai/status");
      if (!statusRes || statusRes.available === false) {
        setAiApiAvailable(false);
      }
    } catch {
      setAiApiAvailable(false);
    }
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.push("/login");
      return;
    }
    setUser(getStoredUser());
    loadInitialData();
  }, [router, loadInitialData]);

  const handleLogout = () => {
    clearAuthSession();
    router.push("/login");
  };

  // Derived cascading filter options from Taxonomy table
  const categoryOptions = [
    { value: "", label: "All Categories" },
    ...taxonomy.map((c) => ({ id: c.id, value: c.name, label: c.name })),
  ];

  const selectedCatNode = taxonomy.find((c) => c.name === filterCategory);
  const availableTypes = selectedCatNode
    ? selectedCatNode.types
    : taxonomy.flatMap((c) => c.types);

  const typeOptions = [
    { value: "", label: "All Types" },
    ...availableTypes.map((t) => ({ id: t.id, value: t.name, label: t.name })),
  ];

  const selectedTypeNode = availableTypes.find((t) => t.name === filterType);
  const availableSubTypes = selectedTypeNode
    ? selectedTypeNode.sub_types
    : availableTypes.flatMap((t) => t.sub_types);

  const subTypeOptions = [
    { value: "", label: "All Sub-Types" },
    ...availableSubTypes.map((st) => ({
      id: st.id,
      value: st.name,
      label: st.name,
    })),
  ];

  // Execute search query against backend API
  const executeSearchQuery = useCallback(
    async (
      rawQuery: string,
      modeOverride?: "quick" | "detailed",
      catOverride?: string,
      typeOverride?: string,
      subTypeOverride?: string
    ) => {
      const activeMode = modeOverride || searchMode;
      const cat = catOverride !== undefined ? catOverride : filterCategory;
      const typ = typeOverride !== undefined ? typeOverride : filterType;
      const sub = subTypeOverride !== undefined ? subTypeOverride : filterSubType;

      if (activeMode === "detailed" && !rawQuery.trim()) {
        setErrorBanner("กรุณาระบุความต้องการของลูกค้าก่อนกดวิเคราะห์ด้วย AI");
        return;
      }

      setErrorBanner(null);
      setIsSearching(true);

      try {
        const res = await apiFetch<AISuggestResponse>("/api/ai/suggest", {
          method: "POST",
          body: JSON.stringify({
            query: rawQuery.trim(),
            search_mode: activeMode,
            model: "Auto (default)",
            category: cat || null,
            type: typ || null,
            sub_type: sub || null,
          }),
        });
        setAiResult(res);
        setCurrentPage(1);
        await loadHistory();
      } catch (err: unknown) {
        if (activeMode === "detailed") {
          setAiApiAvailable(false);
          setSearchMode("quick");
          setErrorBanner(
            "ระบบ AI Detailed Search ไม่พร้อมใช้งานในขณะนี้ ปรับเป็นโหมด Quick Search อัตโนมัติ"
          );
        } else {
          setErrorBanner(
            err instanceof Error ? err.message : "Search request failed"
          );
        }
      } finally {
        setIsSearching(false);
      }
    },
    [searchMode, filterCategory, filterType, filterSubType, loadHistory]
  );

  // Inbound Debounce Search (1.2 seconds) for Quick Search mode
  useEffect(() => {
    if (searchMode !== "quick") return;

    if (skipNextDebounceRef.current) {
      skipNextDebounceRef.current = false;
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const hasQueryOrFilter =
      customerQuery.trim().length > 0 ||
      Boolean(filterCategory) ||
      Boolean(filterType) ||
      Boolean(filterSubType);

    if (!hasQueryOrFilter) {
      setAiResult(null);
      setCurrentPage(1);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      executeSearchQuery(
        customerQuery,
        "quick",
        filterCategory,
        filterType,
        filterSubType
      );
    }, 1200);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [
    customerQuery,
    filterCategory,
    filterType,
    filterSubType,
    searchMode,
    executeSearchQuery,
  ]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    await executeSearchQuery(customerQuery, searchMode);
  };

  // Restore a past search from History
  const handleSelectHistoryItem = (item: SearchHistoryItem) => {
    const restoredMode: "quick" | "detailed" =
      item.search_mode === "detailed" && aiApiAvailable ? "detailed" : "quick";

    skipNextDebounceRef.current = true;
    setSearchMode(restoredMode);
    setCustomerQuery(item.query);
    setCurrentPage(1);

    if (
      item.results &&
      Array.isArray(item.results.suggested_products)
    ) {
      setAiResult({
        query: item.query,
        search_mode: restoredMode,
        model_used: item.model_used || "Auto (default)",
        inference_source: item.results.inference_source || "history",
        executive_summary: item.results.executive_summary || "",
        closing_note: item.results.closing_note,
        suggested_products: item.results.suggested_products,
        supporting_documents: item.results.supporting_documents || [],
        cross_selling: item.results.cross_selling || [],
        created_at: item.created_at,
      });
    } else {
      executeSearchQuery(item.query, restoredMode);
    }
  };

  const promptDeleteHistoryItem = (
    e: React.MouseEvent,
    item: SearchHistoryItem
  ) => {
    e.stopPropagation();
    setConfirmState({
      isOpen: true,
      title: "Delete search history entry",
      description: (
        <>
          Remove{" "}
          <strong className="text-zinc-950 font-semibold">
            &ldquo;{item.query}&rdquo;
          </strong>{" "}
          from your search history?
        </>
      ),
      confirmLabel: "Delete",
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
        try {
          await apiFetch(`/api/ai/history/${item.id}`, { method: "DELETE" });
          await loadHistory();
        } catch (err: unknown) {
          setErrorBanner(
            err instanceof Error ? err.message : "Failed to delete history item"
          );
        }
      },
    });
  };

  const promptClearAllHistory = () => {
    if (searchHistory.length === 0) return;
    setConfirmState({
      isOpen: true,
      title: "Clear all search history",
      description: (
        <>
          Are you sure you want to clear all{" "}
          <strong className="text-zinc-950 font-semibold">
            {searchHistory.length} search history entries
          </strong>
          ?
        </>
      ),
      confirmLabel: "Clear History",
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
        try {
          await apiFetch(`/api/ai/history`, { method: "DELETE" });
          setSearchHistory([]);
        } catch (err: unknown) {
          setErrorBanner(
            err instanceof Error ? err.message : "Failed to clear search history"
          );
        }
      },
    });
  };

  // Determine items to display in Quick Search / Default Catalog Grid (Paginated 10 per page, 3 cols)
  const activeProducts = allProducts.filter((p) => !p.is_deleted);
  const quickDisplayItems: (SuggestedProductResult | Product)[] =
    aiResult && searchMode === "quick"
      ? aiResult.suggested_products
      : activeProducts.filter((p) => {
          const matchCat = !filterCategory || p.category === filterCategory;
          const matchType = !filterType || p.type === filterType;
          const matchSub = !filterSubType || p.sub_type === filterSubType;
          return matchCat && matchType && matchSub;
        });

  const totalQuickItems = quickDisplayItems.length;
  const totalPages = Math.max(1, Math.ceil(totalQuickItems / PAGE_SIZE));
  const paginatedQuickItems = quickDisplayItems.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const activeFilterCount = [filterCategory, filterType, filterSubType].filter(
    Boolean
  ).length;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 pb-20">
      <TubelightNavbar
        activeTab="search"
        activeProductsCount={activeProducts.length}
        user={user}
        onLogout={handleLogout}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 space-y-6">
        {/* Workspace Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50/90 text-blue-700 border border-blue-200/80">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              <span>Product Search</span>
            </span>
            <span className="text-xs sm:text-sm text-zinc-500">
              ค้นหาสินค้าและสเปกเทคนิค หรือวิเคราะห์ความต้องการลูกค้าด้วย AI
            </span>
          </div>
        </div>

        {/* Error Notification Banner */}
        {errorBanner && (
          <div
            role="alert"
            className="flex items-center justify-between rounded-xl bg-rose-50/90 border border-rose-200/80 px-4 py-2.5 text-xs sm:text-sm font-medium text-rose-800"
          >
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              {errorBanner}
            </span>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              className="text-rose-500 hover:text-rose-800 p-1 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/* SINGLE-LINE COMMAND SEARCH BAR + HISTORY + ADVANCE FILTER    */}
        {/* ============================================================ */}
        <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] p-4 sm:p-5">
          {/* Top Mode Switcher & Right Controls (History + Advance Filter) */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
            <div className="inline-flex bg-zinc-100/80 p-1 rounded-xl border border-zinc-200/70 gap-1">
              <button
                type="button"
                onClick={() => setSearchMode("quick")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition ${
                  searchMode === "quick"
                    ? "bg-white text-zinc-900 font-semibold shadow-2xs border border-zinc-200/80"
                    : "text-zinc-600 hover:text-zinc-900 font-medium"
                }`}
              >
                <Zap
                  className={`w-3.5 h-3.5 ${
                    searchMode === "quick" ? "text-blue-600" : "text-zinc-400"
                  }`}
                />
                <span>Quick Search</span>
              </button>

              <button
                type="button"
                disabled={!aiApiAvailable}
                onClick={() => {
                  if (aiApiAvailable) {
                    setSearchMode("detailed");
                  }
                }}
                title={
                  !aiApiAvailable
                    ? "AI API Unavailable — Detailed Search is disabled"
                    : "Detailed AI Search"
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition ${
                  !aiApiAvailable
                    ? "opacity-45 cursor-not-allowed text-zinc-400"
                    : searchMode === "detailed"
                    ? "bg-white text-zinc-900 font-semibold shadow-2xs border border-zinc-200/80"
                    : "text-zinc-600 hover:text-zinc-900 font-medium"
                }`}
              >
                <Sparkles
                  className={`w-3.5 h-3.5 ${
                    searchMode === "detailed"
                      ? "text-indigo-600"
                      : "text-zinc-400"
                  }`}
                />
                <span>
                  Detailed Search (AI)
                  {!aiApiAvailable ? " · Unavailable" : ""}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="toggle-history-button"
                onClick={() => setShowHistory((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  showHistory
                    ? "bg-zinc-900 text-white border-zinc-900"
                    : "bg-white text-zinc-700 border-zinc-200/90 hover:bg-zinc-50"
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>History</span>
                {searchHistory.length > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono tabular-nums ${
                      showHistory
                        ? "bg-white/20 text-white"
                        : "bg-zinc-100 text-zinc-700"
                    }`}
                  >
                    {searchHistory.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowAdvanceFilter((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  showAdvanceFilter || activeFilterCount > 0
                    ? "bg-zinc-900 text-white border-zinc-900"
                    : "bg-white text-zinc-700 border-zinc-200/90 hover:bg-zinc-50"
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Advance Filter</span>
                {activeFilterCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-white text-[10px] font-mono tabular-nums">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Single-Line Search Input + Inline Action Button */}
          <form
            onSubmit={handleFormSubmit}
            className="flex items-center gap-2.5"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                data-testid="search-query-input"
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                placeholder={
                  searchMode === "quick"
                    ? "ค้นหาชื่อสินค้า แบรนด์ หรือสเปก (ค้นหาอัตโนมัติใน 1.2 วินาที)..."
                    : "อธิบายโจทย์หรือความต้องการของลูกค้า แล้วกดส่งเพื่อให้ AI แนะนำรุ่นที่เหมาะสม..."
                }
                className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-zinc-50/60 border border-zinc-200/90 text-sm text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 focus:bg-white transition"
              />
              {customerQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomerQuery("");
                    setAiResult(null);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="submit"
              data-testid="find-products-button"
              disabled={
                isSearching ||
                (searchMode === "detailed" && !aiApiAvailable)
              }
              className="px-4 sm:px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition shrink-0 disabled:opacity-50 shadow-2xs"
            >
              <span>
                {isSearching
                  ? "กำลังค้นหา..."
                  : searchMode === "quick"
                  ? "ค้นหา"
                  : "วิเคราะห์ด้วย AI"}
              </span>
              <CornerDownLeft className="w-3.5 h-3.5 opacity-80" />
            </button>
          </form>

          {/* Collapsible Advance Filter (Category -> Type -> Sub Type) */}
          {showAdvanceFilter && (
            <div className="mt-4 pt-4 border-t border-zinc-100 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <TaxonomyCombobox
                label="Category"
                placeholder="All Categories"
                value={filterCategory}
                options={categoryOptions}
                allowCreate={false}
                onChange={(val) => {
                  setFilterCategory(val);
                  setFilterType("");
                  setFilterSubType("");
                  setCurrentPage(1);
                }}
              />
              <TaxonomyCombobox
                label="Type"
                placeholder="All Types"
                value={filterType}
                options={typeOptions}
                allowCreate={false}
                onChange={(val) => {
                  setFilterType(val);
                  setFilterSubType("");
                  setCurrentPage(1);
                }}
              />
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <TaxonomyCombobox
                    label="Sub-Type"
                    placeholder="All Sub-Types"
                    value={filterSubType}
                    options={subTypeOptions}
                    allowCreate={false}
                    onChange={(val) => {
                      setFilterSubType(val);
                      setCurrentPage(1);
                    }}
                  />
                </div>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterCategory("");
                      setFilterType("");
                      setFilterSubType("");
                      setCurrentPage(1);
                    }}
                    className="px-3 py-2 rounded-lg border border-zinc-200/90 bg-zinc-50 hover:bg-zinc-100 text-xs font-medium text-zinc-600 inline-flex items-center gap-1 shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Collapsible Search History Panel */}
          {showHistory && (
            <div
              data-testid="search-history-panel"
              className="mt-4 pt-4 border-t border-zinc-100 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium text-zinc-600">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Recent Search History ({searchHistory.length})</span>
                </div>
                {searchHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={promptClearAllHistory}
                    className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-rose-600 transition"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear all</span>
                  </button>
                )}
              </div>

              {searchHistory.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-400 bg-zinc-50/50 rounded-xl border border-dashed border-zinc-200/80">
                  ยังไม่มีประวัติการค้นหา
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto divide-y divide-zinc-100 rounded-xl border border-zinc-200/80 bg-zinc-50/40">
                  {searchHistory.map((item) => {
                    const isDetailed = item.search_mode === "detailed";
                    const count =
                      item.results?.suggested_products?.length ?? 0;
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelectHistoryItem(item)}
                        className="px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-white cursor-pointer transition group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span
                            className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-md border shrink-0 ${
                              isDetailed
                                ? "bg-indigo-50/90 text-indigo-700 border-indigo-200/80"
                                : "bg-blue-50/90 text-blue-700 border-blue-200/80"
                            }`}
                          >
                            {isDetailed ? "AI Detailed" : "Quick"}
                          </span>
                          <span className="text-xs sm:text-sm font-medium text-zinc-800 group-hover:text-blue-600 truncate transition">
                            {item.query}
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          {count > 0 && (
                            <span className="text-[11px] font-mono text-zinc-400 tabular-nums hidden sm:inline">
                              {count} items
                            </span>
                          )}
                          <span className="text-[11px] font-mono text-zinc-400 tabular-nums hidden md:inline">
                            {new Date(item.created_at).toLocaleTimeString(
                              "th-TH",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => promptDeleteHistoryItem(e, item)}
                            title="Delete entry"
                            className="p-1 rounded-md text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* MODE A: DETAILED SEARCH (AI) — EDITORIAL CONVERSATIONAL VIEW */}
        {/* ============================================================ */}
        {searchMode === "detailed" && aiResult && (
          <div
            data-testid="ai-results-section"
            className="rounded-2xl bg-white border border-zinc-200/90 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.05)] overflow-hidden"
          >
            <div className="p-6 sm:p-8 space-y-6">
              {/* 1. User Query Bubble on Top Right */}
              {aiResult.query && (
                <div className="flex justify-end">
                  <div className="inline-block max-w-xl rounded-2xl bg-zinc-900 text-white px-4 py-2.5 text-sm font-medium shadow-2xs">
                    {aiResult.query}
                  </div>
                </div>
              )}

              {/* 2. AI Conversational Intro Summary */}
              <div className="space-y-2.5 text-sm sm:text-[15px] text-zinc-700 leading-relaxed">
                <p>{aiResult.executive_summary}</p>
                <p className="font-semibold text-zinc-950 pt-1">
                  รุ่นที่น่าพิจารณามีดังนี้
                </p>
              </div>

              {/* 3. Numbered Product Recommendations (Horizontal Card Row per Item) */}
              <div className="divide-y divide-zinc-100">
                {aiResult.suggested_products.map((prod, idx) => (
                  <div
                    key={`${prod.name}-${idx}`}
                    onClick={() => setSelectedProductModal(prod)}
                    className="py-5 first:pt-2 last:pb-2 flex flex-col sm:flex-row items-start gap-5 group cursor-pointer hover:bg-zinc-50/80 rounded-xl px-3 -mx-3 transition"
                  >
                    {/* Left: Rounded Square Product Thumbnail */}
                    <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl bg-zinc-50 border border-zinc-200/80 shrink-0 overflow-hidden flex items-center justify-center relative shadow-2xs">
                      <Package className="w-7 h-7 text-zinc-300" />
                      {prod.image_url && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={prod.image_url}
                          alt={prod.name}
                          className="w-full h-full object-cover absolute inset-0 group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      )}
                    </div>

                    {/* Right: Numbered Title, Tagline, Bullets, and Action Link + Capsules */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <h3 className="text-base sm:text-lg font-semibold text-zinc-950 group-hover:text-blue-600 transition tracking-tight">
                        {idx + 1}. {prod.name} — {prod.brand}
                      </h3>

                      <p className="text-xs sm:text-sm font-medium text-zinc-600">
                        {prod.reasoning}
                      </p>

                      {prod.key_benefits && prod.key_benefits.length > 0 && (
                        <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-zinc-600 pt-0.5">
                          {prod.key_benefits.map((b, i) => (
                            <li key={i} className="leading-relaxed">
                              {b}
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Action Link + Color Capsules (Click opens Product Detail Modal) */}
                      <div className="pt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProductModal(prod);
                          }}
                          className="inline-flex items-center gap-1 text-xs sm:text-sm font-medium text-zinc-900 underline underline-offset-4 decoration-zinc-300 hover:decoration-blue-600 hover:text-blue-600 transition"
                        >
                          <span>ดูข้อมูลและรายละเอียด {prod.name}</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>

                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-800 border border-zinc-200/80">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          {prod.brand}
                        </span>

                        <span
                          className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${getCapsuleStyle(
                            prod.category,
                            "category"
                          )}`}
                        >
                          {prod.category}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Bottom Advisory Summary Paragraph */}
            {aiResult.closing_note && (
              <div className="px-6 sm:px-8 py-4 bg-zinc-50/80 border-t border-zinc-200/70 text-xs sm:text-sm text-zinc-600 leading-relaxed">
                <p>{aiResult.closing_note}</p>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* MODE B: QUICK SEARCH & CATALOG GRID (3 Cols, 10 per page)    */}
        {/* ============================================================ */}
        {(searchMode === "quick" || !aiResult) && (
          <div data-testid="ai-results-section" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-zinc-900">
                  {aiResult && searchMode === "quick"
                    ? `Search Results (${totalQuickItems})`
                    : `Product Catalog (${totalQuickItems})`}
                </h2>
                <span className="text-xs text-zinc-400">
                  · เลือกการ์ดเพื่อดูรายละเอียดและเอกสารประกอบ
                </span>
              </div>

              <span className="text-xs font-mono text-zinc-500 tabular-nums">
                Page {currentPage} of {totalPages}
              </span>
            </div>

            {paginatedQuickItems.length === 0 ? (
              <div className="bg-white rounded-2xl border border-zinc-200/80 p-12 text-center">
                <Package className="w-7 h-7 text-zinc-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-zinc-700">
                  ไม่พบสินค้าที่ตรงกับเงื่อนไขการค้นหา
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  ลองเปลี่ยนคำค้นหาหรือรีเซ็ตตัวกรอง Advance Filter
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
                {paginatedQuickItems.map((prod, idx) => {
                  const matchScore =
                    "match_score" in prod ? prod.match_score : undefined;
                  return (
                    <div
                      key={`${prod.name}-${idx}`}
                      onClick={() => setSelectedProductModal(prod)}
                      className="group cursor-pointer rounded-xl border border-zinc-200/85 bg-white overflow-hidden hover:border-zinc-300 hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.06)] transition-all duration-200 flex flex-col justify-between"
                    >
                      <div>
                        {/* Compact Image Thumbnail */}
                        <div className="w-full h-40 bg-zinc-100/70 relative overflow-hidden border-b border-zinc-100 flex items-center justify-center">
                          <Package className="w-7 h-7 text-zinc-300" />
                          {prod.image_url && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={prod.image_url}
                              alt={prod.name}
                              loading="lazy"
                              className="w-full h-full object-cover absolute inset-0 group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                          )}
                          {typeof matchScore === "number" && (
                            <span className="absolute top-3 left-3 inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-white/95 text-zinc-900 border border-zinc-200/80 shadow-2xs tabular-nums">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              {matchScore}%
                            </span>
                          )}
                          <span className="absolute top-3 right-3 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-zinc-900/90 text-white">
                            {prod.brand}
                          </span>
                        </div>

                        {/* Compact Card Info */}
                        <div className="p-4">
                          <div className="flex flex-wrap items-center gap-1.5 mb-2">
                            <span
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${getCapsuleStyle(
                                prod.category,
                                "category"
                              )}`}
                            >
                              {prod.category}
                            </span>
                            <span
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${getCapsuleStyle(
                                prod.type,
                                "type"
                              )}`}
                            >
                              {prod.type}
                            </span>
                            <span
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${getCapsuleStyle(
                                prod.sub_type,
                                "sub_type"
                              )}`}
                            >
                              {prod.sub_type}
                            </span>
                          </div>

                          <h3 className="font-semibold text-zinc-900 text-sm sm:text-[15px] line-clamp-1 group-hover:text-blue-600 transition tracking-tight">
                            {prod.name}
                          </h3>
                        </div>
                      </div>

                      <div className="px-4 py-2.5 bg-zinc-50/60 border-t border-zinc-100 flex items-center justify-between text-xs font-medium text-zinc-500 group-hover:text-zinc-900 transition">
                        <span>ดูรายละเอียดและเอกสารประกอบ</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-900 transition" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Bar (10 items per page) */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 pt-4">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200/90 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-700 disabled:opacity-40 transition"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (pageNum) => (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-xs font-mono font-semibold tabular-nums transition ${
                        currentPage === pageNum
                          ? "bg-zinc-900 text-white"
                          : "bg-white border border-zinc-200/90 text-zinc-700 hover:bg-zinc-50"
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                )}

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200/90 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-700 disabled:opacity-40 transition"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Product Detail Modal */}
      <ProductDetailModal
        isOpen={Boolean(selectedProductModal)}
        product={selectedProductModal}
        onClose={() => setSelectedProductModal(null)}
      />

      {/* Confirmation Dialog for History Deletion */}
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel={confirmState.confirmLabel}
        variant="danger"
        onConfirm={confirmState.onConfirm}
        onCancel={() =>
          setConfirmState((prev) => ({ ...prev, isOpen: false }))
        }
      />
    </div>
  );
}
