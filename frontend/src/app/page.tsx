"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Package,
  BarChart3,
  SlidersHorizontal,
  History,
  BookTemplate,
  Plus,
  SquarePen,
  Trash2,
  RotateCcw,
  Archive,
  X,
  Filter,
  LogOut,
  FileText,
  GitBranchPlus,
  CheckCircle2,
  Sparkles,
  Download,
  Clock,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import {
  apiFetch,
  clearAuthSession,
  getAuthToken,
  getStoredUser,
  getTokenExpiresAt,
  Product,
  ProductCreatePayload,
  AISuggestResponse,
  SearchHistoryItem,
  AnalyticsData,
  UserProfile,
} from "@/lib/api";

type ActiveTab = "search" | "manage" | "analytics";

const SEARCH_TEMPLATES = [
  {
    label: "GMP mAb Chromatography System",
    query:
      "Customer needs an automated single-use chromatography system for GMP monoclonal antibody purification with extractables validation reports.",
  },
  {
    label: "High-Capacity Protein A Column",
    query:
      "Looking for an alkaline-stable Protein A affinity resin column for high-titer bispecific antibody capture and CIP stability data.",
  },
  {
    label: "Sterile Buffer & Media Filtration",
    query:
      "Customer requires a low-protein-binding 0.22 µm sterilizing grade PES capsule filter for chromatography buffers and bulk drug substance.",
  },
];

const EMPTY_FORM: ProductCreatePayload = {
  name: "",
  brand: "",
  description: "",
  image_url: "",
  category: "",
  type: "",
  sub_type: "",
};

export default function SalesSupportHubPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("search");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  // Product Search State (Figure 2)
  const [searchMode, setSearchMode] = useState<"quick" | "detailed">("quick");
  const [selectedModel, setSelectedModel] = useState<string>("Auto (default)");
  const [customerQuery, setCustomerQuery] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [aiResult, setAiResult] = useState<AISuggestResponse | null>(null);
  const [historyList, setHistoryList] = useState<SearchHistoryItem[]>([]);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState<boolean>(false);
  const [showTemplatesMenu, setShowTemplatesMenu] = useState<boolean>(false);

  // Manage Products State (Figure 3)
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [catalogView, setCatalogView] = useState<"active" | "trash">("active");
  const [catalogSearch, setCatalogSearch] = useState<string>("");
  const [selectedCategory, setSelectedCategory] =
    useState<string>("All Categories");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductCreatePayload>(EMPTY_FORM);
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);

  // Analytics State
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  // Feedback banner
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadHubData = useCallback(async () => {
    try {
      const [prods, hist, stats] = await Promise.all([
        apiFetch<Product[]>("/api/products?include_deleted=true"),
        apiFetch<SearchHistoryItem[]>("/api/ai/history"),
        apiFetch<AnalyticsData>("/api/analytics"),
      ]);
      setAllProducts(prods);
      setHistoryList(hist);
      setAnalytics(stats);
    } catch (err: unknown) {
      setErrorBanner(
        err instanceof Error ? err.message : "Failed to load catalog data"
      );
    }
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.push("/login");
      return;
    }
    setUser(getStoredUser());
    setExpiresAt(getTokenExpiresAt());
    loadHubData();
  }, [router, loadHubData]);

  const handleLogout = () => {
    clearAuthSession();
    router.push("/login");
  };

  // --- AI Product Search Handlers ---
  const handleFindProducts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerQuery.trim() || customerQuery.trim().length < 3) {
      setErrorBanner("Please describe what your customer needs (at least 3 characters).");
      return;
    }
    setErrorBanner(null);
    setIsSearching(true);
    try {
      const res = await apiFetch<AISuggestResponse>("/api/ai/suggest", {
        method: "POST",
        body: JSON.stringify({
          query: customerQuery.trim(),
          search_mode: searchMode,
          model: selectedModel,
        }),
      });
      setAiResult(res);
      const updatedHist = await apiFetch<SearchHistoryItem[]>("/api/ai/history");
      setHistoryList(updatedHist);
    } catch (err: unknown) {
      setErrorBanner(
        err instanceof Error ? err.message : "AI inference failed"
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleExportResults = () => {
    if (!aiResult) return;
    const blob = new Blob([JSON.stringify(aiResult, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-support-recommendation-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Product Portfolio CRUD Handlers (Figure 3) ---
  const activeProducts = allProducts.filter((p) => !p.is_deleted);
  const trashProducts = allProducts.filter((p) => p.is_deleted);
  const currentCatalogList =
    catalogView === "active" ? activeProducts : trashProducts;

  const categories = [
    "All Categories",
    ...Array.from(new Set(allProducts.map((p) => p.category))),
  ];

  const filteredProducts = currentCatalogList.filter((p) => {
    const matchesCategory =
      selectedCategory === "All Categories" || p.category === selectedCategory;
    const q = catalogSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData(EMPTY_FORM);
    setErrorBanner(null);
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      brand: product.brand,
      description: product.description,
      image_url: product.image_url,
      category: product.category,
      type: product.type,
      sub_type: product.sub_type,
    });
    setErrorBanner(null);
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.description.trim().length < 10) {
      setErrorBanner("Description must be at least 10 characters.");
      return;
    }
    setErrorBanner(null);
    setFormSubmitting(true);

    try {
      if (editingProduct) {
        await apiFetch<Product>(`/api/products/${editingProduct.id}`, {
          method: "PUT",
          body: JSON.stringify(formData),
        });
        showToast(`Updated "${formData.name}" successfully.`);
      } else {
        await apiFetch<Product>("/api/products", {
          method: "POST",
          body: JSON.stringify(formData),
        });
        showToast(`Created "${formData.name}" in catalog.`);
      }
      setIsModalOpen(false);
      await loadHubData();
    } catch (err: unknown) {
      setErrorBanner(
        err instanceof Error ? err.message : "Failed to save product"
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    try {
      await apiFetch(`/api/products/${product.id}`, { method: "DELETE" });
      setSelectedIds((prev) => prev.filter((id) => id !== product.id));
      showToast(`Moved "${product.name}" to Trash (Soft Deleted). You can restore it anytime.`);
      await loadHubData();
    } catch (err: unknown) {
      setErrorBanner(
        err instanceof Error ? err.message : "Failed to delete product"
      );
    }
  };

  const handleRestoreProduct = async (product: Product) => {
    try {
      await apiFetch<Product>(`/api/products/${product.id}/restore`, {
        method: "POST",
      });
      showToast(`Restored "${product.name}" back to Active Catalog!`);
      await loadHubData();
    } catch (err: unknown) {
      setErrorBanner(
        err instanceof Error ? err.message : "Failed to restore product"
      );
    }
  };

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredProducts.map((p) => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      await Promise.all(
        selectedIds.map((id) =>
          apiFetch(`/api/products/${id}`, { method: "DELETE" })
        )
      );
      showToast(`Deleted ${selectedIds.length} selected product(s).`);
      setSelectedIds([]);
      await loadHubData();
    } catch (err: unknown) {
      setErrorBanner(
        err instanceof Error ? err.message : "Failed to delete selected products"
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#eef2fb] pb-16">
      {/* Top User Session Bar */}
      <div className="bg-white/80 backdrop-blur border-b border-slate-200 px-6 py-2.5">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Protected Route (JWT Active)
            </span>
            {expiresAt && (
              <span className="hidden sm:inline-flex items-center gap-1 text-slate-500">
                <Clock className="w-3.5 h-3.5" />
                Expires:{" "}
                {new Date(expiresAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                (1h Token)
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <span>
                Signed in as{" "}
                <strong className="text-slate-900">{user.username}</strong> (
                {user.email})
              </span>
            )}
            <button
              type="button"
              onClick={handleLogout}
              data-testid="logout-button"
              className="inline-flex items-center gap-1 text-slate-700 hover:text-red-600 font-medium transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Header & Navigation Tabs (Matches Figure 2 & Figure 3) */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
        <header className="text-center mb-6">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Sales Support Hub
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-600">
            AI-powered product search, model-aware recommendations, and portfolio
            management—built for fast, customer-ready answers.
          </p>
        </header>

        {/* Top 3 Segmented Tabs */}
        <div
          role="tablist"
          className="grid grid-cols-3 bg-slate-200/80 p-1 rounded-xl mb-6 border border-slate-300/60"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "search"}
            data-testid="tab-product-search"
            onClick={() => setActiveTab("search")}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition ${
              activeTab === "search"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-700 hover:text-slate-900"
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Product Search</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "manage"}
            data-testid="tab-manage-products"
            onClick={() => setActiveTab("manage")}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition ${
              activeTab === "manage"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-700 hover:text-slate-900"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Manage Products</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "analytics"}
            data-testid="tab-analytics-dashboard"
            onClick={() => setActiveTab("analytics")}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition ${
              activeTab === "analytics"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-700 hover:text-slate-900"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Analytics Dashboard</span>
          </button>
        </div>

        {/* Notifications */}
        {errorBanner && (
          <div
            role="alert"
            className="mb-4 flex items-center justify-between rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
          >
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {errorBanner}
            </span>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              className="text-red-500 hover:text-red-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {toastMessage && (
          <div
            role="status"
            className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 1: PRODUCT SEARCH (Matches Figure 2 & Figure 1)          */}
        {/* ============================================================ */}
        {activeTab === "search" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-6">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Search className="w-5 h-5 text-slate-800" />
                  <span>AI-Powered Product Search</span>
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Use natural language to find products, select a model for
                  inference, and export results with AI reasoning
                </p>
              </div>

              {/* Search Mode + Model + History + Templates Controls Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="inline-flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setSearchMode("quick")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                      searchMode === "quick"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Search className="w-3.5 h-3.5" />
                    Quick Search
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchMode("detailed")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                      searchMode === "detailed"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    Detailed Search
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <label htmlFor="model-select" className="font-medium">
                      Model:
                    </label>
                    <select
                      id="model-select"
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    >
                      <option value="Auto (default)">Auto (default)</option>
                      <option value="google/gemini-2.0-flash-exp:free">
                        Google Gemini 2.0 Flash (OpenRouter)
                      </option>
                      <option value="meta-llama/llama-3.3-70b-instruct:free">
                        Llama 3.3 70B Instruct (OpenRouter)
                      </option>
                      <option value="openai/gpt-4o-mini">
                        OpenAI GPT-4o Mini (OpenRouter)
                      </option>
                      <option value="anthropic/claude-3.5-haiku">
                        Claude 3.5 Haiku (OpenRouter)
                      </option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowHistoryDrawer((v) => !v);
                      setShowTemplatesMenu(false);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition"
                  >
                    <History className="w-3.5 h-3.5" />
                    History ({historyList.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowTemplatesMenu((v) => !v);
                      setShowHistoryDrawer(false);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition"
                  >
                    <BookTemplate className="w-3.5 h-3.5" />
                    Templates
                  </button>
                </div>
              </div>

              {/* Optional Templates Popover */}
              {showTemplatesMenu && (
                <div className="mb-4 rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <div className="text-xs font-semibold text-slate-700 mb-2">
                    Select a Sales Scenario Template:
                  </div>
                  <div className="grid sm:grid-cols-3 gap-2">
                    {SEARCH_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.label}
                        type="button"
                        onClick={() => {
                          setCustomerQuery(tpl.query);
                          setShowTemplatesMenu(false);
                        }}
                        className="text-left p-2.5 rounded-lg bg-white border border-slate-200 hover:border-slate-400 transition"
                      >
                        <div className="text-xs font-bold text-slate-800">
                          {tpl.label}
                        </div>
                        <div className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                          {tpl.query}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Optional History Drawer */}
              {showHistoryDrawer && (
                <div className="mb-4 rounded-xl bg-slate-50 border border-slate-200 p-3 max-h-52 overflow-y-auto">
                  <div className="text-xs font-semibold text-slate-700 mb-2">
                    Recent Search History:
                  </div>
                  <div className="space-y-2">
                    {historyList.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setCustomerQuery(item.query);
                          setShowHistoryDrawer(false);
                        }}
                        className="w-full text-left p-2.5 rounded-lg bg-white border border-slate-200 hover:border-slate-400 flex items-center justify-between gap-2"
                      >
                        <span className="text-xs text-slate-800 truncate">
                          {item.query}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                          {item.model_used}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Search Textarea & Submit Button (Matches Figure 2) */}
              <form onSubmit={handleFindProducts}>
                <textarea
                  rows={3}
                  data-testid="search-query-input"
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  placeholder="Describe what your customer needs..."
                  className="w-full rounded-xl bg-slate-100/80 border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition"
                />
                <button
                  type="submit"
                  data-testid="find-products-button"
                  disabled={isSearching}
                  className="mt-3 w-full py-2.5 px-4 rounded-xl bg-slate-600 hover:bg-slate-800 text-white font-semibold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  <Search className="w-4 h-4" />
                  <span>
                    {isSearching ? "Analyzing with OpenRouter AI..." : "Find Products"}
                  </span>
                </button>
              </form>
            </div>

            {/* AI Recommendation Results (Matches Figure 1: 3 Core Features) */}
            {aiResult && (
              <div
                data-testid="ai-results-section"
                className="space-y-6 animate-fadeIn"
              >
                {/* Executive Summary Bar */}
                <div className="bg-white rounded-2xl shadow-sm border border-indigo-200 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full">
                      <Sparkles className="w-3.5 h-3.5" />
                      AI Sales Specialist Reasoning ({aiResult.model_used})
                    </div>
                    <button
                      type="button"
                      onClick={handleExportResults}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded-lg px-3 py-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export Results
                    </button>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {aiResult.executive_summary}
                  </p>
                </div>

                {/* Feature 1: Product Suggestion */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                    <Package className="w-5 h-5 text-amber-600" />
                    1. Product Suggestion (แนะนำผลิตภัณฑ์ที่เหมาะสม)
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Suggests optimal products from the catalog based on customer
                    search input
                  </p>

                  <div className="grid md:grid-cols-3 gap-4">
                    {aiResult.suggested_products.map((prod, idx) => (
                      <div
                        key={`${prod.name}-${idx}`}
                        className="rounded-xl border border-slate-200 p-4 flex flex-col justify-between bg-slate-50/50"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              {prod.match_score}% Match
                            </span>
                            <span className="text-[11px] font-medium text-slate-500">
                              {prod.brand}
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-900 text-sm">
                            {prod.name}
                          </h4>
                          <div className="text-[11px] text-indigo-700 font-medium mt-0.5 mb-2">
                            {prod.category} • {prod.sub_type}
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed mb-3">
                            {prod.reasoning}
                          </p>
                        </div>

                        {prod.key_benefits && prod.key_benefits.length > 0 && (
                          <ul className="space-y-1 border-t border-slate-200/80 pt-2.5 text-[11px] text-slate-600">
                            {prod.key_benefits.map((b, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Feature 2 & Feature 3 Grid: Supporting Documents & Cross-selling */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Feature 2: Supporting Documents */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-orange-600" />
                      2. Supporting Documents (เอกสารอ้างอิง & Validation)
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">
                      Recommends publications and validation reports to build
                      customer confidence
                    </p>
                    <div className="space-y-3">
                      {aiResult.supporting_documents.map((doc, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-orange-50/40 border border-orange-200/70"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-orange-100 text-orange-800">
                              {doc.doc_type}
                            </span>
                            <span className="text-[11px] font-medium text-slate-600">
                              For: {doc.related_product}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-slate-900">
                            {doc.title}
                          </div>
                          <p className="text-xs text-slate-600 mt-1">
                            {doc.relevance}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Feature 3: Cross-selling */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                      <GitBranchPlus className="w-5 h-5 text-rose-600" />
                      3. Cross-selling (สินค้าพ่วงที่ควรเสนอขายคู่กัน)
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">
                      Identifies related products and consumables for
                      cross-selling
                    </p>
                    <div className="space-y-3">
                      {aiResult.cross_selling.map((cs, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-rose-50/40 border border-rose-200/70"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                              {cs.category}
                            </span>
                            <span className="text-[11px] font-medium text-slate-600">
                              Pair with: {cs.paired_with}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-slate-900">
                            {cs.product_name}
                          </div>
                          <p className="text-xs text-slate-600 mt-1">
                            {cs.pitch_reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: MANAGE PRODUCTS (Matches Figure 3 Exactly)            */}
        {/* ============================================================ */}
        {activeTab === "manage" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-slate-800" />
                <span>Product Portfolio Management</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Add, edit, and curate your catalog to improve recommendation
                quality
              </p>
            </div>

            {/* Catalog Header Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex flex-wrap items-center gap-3">
                <h3
                  data-testid="catalog-count-heading"
                  className="text-sm sm:text-base font-bold text-slate-900"
                >
                  Product Catalog ({filteredProducts.length} of{" "}
                  {catalogView === "active"
                    ? activeProducts.length
                    : trashProducts.length}{" "}
                  products)
                </h3>

                {/* Active vs Trash View Toggle */}
                <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setCatalogView("active");
                      setSelectedIds([]);
                    }}
                    className={`px-3 py-1 rounded-md font-medium transition ${
                      catalogView === "active"
                        ? "bg-white text-slate-900 shadow-sm font-semibold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Active ({activeProducts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCatalogView("trash");
                      setSelectedIds([]);
                    }}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-md font-medium transition ${
                      catalogView === "trash"
                        ? "bg-white text-rose-700 shadow-sm font-semibold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Archive className="w-3 h-3" />
                    Trash ({trashProducts.length})
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selectedIds.length > 0 && catalogView === "active" && (
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white px-3 py-2 text-xs font-semibold transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Move Selected to Trash ({selectedIds.length})
                  </button>
                )}
                <button
                  type="button"
                  data-testid="add-product-button"
                  onClick={openAddModal}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-white px-3.5 py-2 text-xs font-semibold transition"
                >
                  <Plus className="w-4 h-4" />
                  Add Product
                </button>
              </div>
            </div>

            {/* Search & Filter Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Search products by name, brand, or description..."
                  className="w-full rounded-lg bg-slate-100 border border-slate-200 pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  aria-label="Filter by category"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="rounded-lg bg-slate-100 border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Select All Checkbox */}
            <div className="flex items-center gap-2 mb-3 text-xs text-slate-600 px-1">
              <input
                id="select-all-products"
                type="checkbox"
                checked={
                  filteredProducts.length > 0 &&
                  selectedIds.length === filteredProducts.length
                }
                onChange={(e) => handleToggleSelectAll(e.target.checked)}
                className="rounded border-slate-300"
              />
              <label htmlFor="select-all-products" className="cursor-pointer">
                Select all visible products
              </label>
            </div>

            {/* Product List Cards (Matches Figure 3) */}
            <div className="space-y-3">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  data-testid={`product-card-${product.id}`}
                  className="rounded-xl border border-slate-200 p-4 flex items-start justify-between gap-4 hover:border-slate-300 transition bg-white"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${product.name}`}
                      checked={selectedIds.includes(product.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds((prev) => [...prev, product.id]);
                        } else {
                          setSelectedIds((prev) =>
                            prev.filter((id) => id !== product.id)
                          );
                        }
                      }}
                      className="mt-1 rounded border-slate-300"
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-sm">
                          {product.name}
                        </h4>
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                          {product.brand}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium">
                          {product.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                        {product.description}
                      </p>
                      <div className="text-[11px] text-slate-400 mt-1.5">
                        Type: {product.type} • Sub Type: {product.sub_type}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {product.is_deleted ? (
                      <button
                        type="button"
                        aria-label={`Restore ${product.name}`}
                        data-testid={`restore-product-${product.name}`}
                        onClick={() => handleRestoreProduct(product)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-semibold text-xs transition shadow-xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Restore</span>
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          aria-label={`Edit ${product.name}`}
                          data-testid={`edit-product-${product.name}`}
                          onClick={() => openEditModal(product)}
                          className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition"
                        >
                          <SquarePen className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${product.name}`}
                          data-testid={`delete-product-${product.name}`}
                          onClick={() => handleDeleteProduct(product)}
                          className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-50 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {filteredProducts.length === 0 && (
                <div className="text-center py-10 text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl">
                  No matching products found.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: ANALYTICS DASHBOARD                                   */}
        {/* ============================================================ */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="text-xs font-medium text-slate-500">
                  Total Catalog Products
                </div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">
                  {analytics?.total_products ?? activeProducts.length}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="text-xs font-medium text-slate-500">
                  AI Customer Searches
                </div>
                <div className="text-2xl font-extrabold text-indigo-600 mt-1">
                  {analytics?.total_searches ?? historyList.length}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="text-xs font-medium text-slate-500">
                  Supporting Validation Docs
                </div>
                <div className="text-2xl font-extrabold text-orange-600 mt-1">
                  {analytics?.total_supporting_documents ?? 6}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="text-xs font-medium text-slate-500">
                  Cross-Selling Pairs
                </div>
                <div className="text-2xl font-extrabold text-rose-600 mt-1">
                  {analytics?.total_cross_sell_links ?? 6}
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 mb-4">
                  Portfolio Breakdown by Category
                </h3>
                <div className="space-y-3">
                  {(analytics?.categories_breakdown ?? []).map((item) => (
                    <div key={item.category}>
                      <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                        <span>{item.category}</span>
                        <span>{item.count} product(s)</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-slate-900 rounded-full"
                          style={{
                            width: `${Math.min(
                              100,
                              (item.count / Math.max(1, activeProducts.length)) * 100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 mb-4">
                  Portfolio Breakdown by Brand
                </h3>
                <div className="space-y-3">
                  {(analytics?.brands_breakdown ?? []).map((item) => (
                    <div
                      key={item.brand}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                    >
                      <span className="font-semibold text-slate-800">
                        {item.brand}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                        {item.count} item(s)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* MODAL: ADD / EDIT PRODUCT (Matches Figure 3 Modal Overlay)   */}
      {/* ============================================================ */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-200 p-6 relative">
            <button
              type="button"
              aria-label="Close modal"
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 id="modal-title" className="text-base font-bold text-slate-900">
              {editingProduct ? "Edit Product" : "Add New Product"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 mb-5">
              {editingProduct
                ? "Update product information in your catalog"
                : "Add a new product to your catalog"}
            </p>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              {/* Row 1: Product Name * | Brand * */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="product-name"
                    className="block text-xs font-semibold text-slate-800 mb-1"
                  >
                    Product Name *
                  </label>
                  <input
                    id="product-name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full rounded-lg bg-slate-100 border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor="product-brand"
                    className="block text-xs font-semibold text-slate-800 mb-1"
                  >
                    Brand *
                  </label>
                  <input
                    id="product-brand"
                    type="text"
                    required
                    value={formData.brand}
                    onChange={(e) =>
                      setFormData({ ...formData, brand: e.target.value })
                    }
                    className="w-full rounded-lg bg-slate-100 border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
                  />
                </div>
              </div>

              {/* Row 2: Description * (minimum 10 characters) */}
              <div>
                <label
                  htmlFor="product-description"
                  className="block text-xs font-semibold text-slate-800 mb-1"
                >
                  Description * (minimum 10 characters)
                </label>
                <textarea
                  id="product-description"
                  rows={3}
                  required
                  minLength={10}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full rounded-lg bg-slate-100 border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
                />
                <div className="text-[11px] text-slate-400 mt-1">
                  {formData.description.length} characters
                </div>
              </div>

              {/* Row 3: Image URL * */}
              <div>
                <label
                  htmlFor="product-image-url"
                  className="block text-xs font-semibold text-slate-800 mb-1"
                >
                  Image URL *
                </label>
                <input
                  id="product-image-url"
                  type="text"
                  required
                  value={formData.image_url}
                  onChange={(e) =>
                    setFormData({ ...formData, image_url: e.target.value })
                  }
                  placeholder="https://..."
                  className="w-full rounded-lg bg-slate-100 border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
                />
              </div>

              {/* Row 4: Category * | Type * | Sub Type * */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="product-category"
                    className="block text-xs font-semibold text-slate-800 mb-1"
                  >
                    Category *
                  </label>
                  <input
                    id="product-category"
                    type="text"
                    required
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full rounded-lg bg-slate-100 border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor="product-type"
                    className="block text-xs font-semibold text-slate-800 mb-1"
                  >
                    Type *
                  </label>
                  <input
                    id="product-type"
                    type="text"
                    required
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value })
                    }
                    className="w-full rounded-lg bg-slate-100 border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor="product-sub-type"
                    className="block text-xs font-semibold text-slate-800 mb-1"
                  >
                    Sub Type *
                  </label>
                  <input
                    id="product-sub-type"
                    type="text"
                    required
                    value={formData.sub_type}
                    onChange={(e) =>
                      setFormData({ ...formData, sub_type: e.target.value })
                    }
                    className="w-full rounded-lg bg-slate-100 border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
                  />
                </div>
              </div>

              {/* Modal Actions: Cancel | Create Product */}
              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="submit-product-modal"
                  disabled={formSubmitting}
                  className="px-4 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold transition disabled:opacity-50"
                >
                  {formSubmitting
                    ? "Saving..."
                    : editingProduct
                    ? "Save Changes"
                    : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
