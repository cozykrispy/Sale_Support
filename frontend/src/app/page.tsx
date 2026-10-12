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
  AlertCircle,
  Users,
  Upload,
  Zap,
  Tag,
  Box,
  ArrowUpRight,
  Layers,
  Cpu,
  LayoutGrid,
  List,
  Table,
  Columns3,
} from "lucide-react";
import {
  apiFetch,
  clearAuthSession,
  getAuthToken,
  getStoredUser,
  getTokenExpiresAt,
  uploadProductImage,
  Product,
  ProductCreatePayload,
  AISuggestResponse,
  SearchHistoryItem,
  AnalyticsData,
  UserProfile,
} from "@/lib/api";
import { TubelightNavbar } from "@/components/ui/tubelight-navbar";
import { AnimatePresence, motion } from "framer-motion";

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
  status: "active",
};

export default function SalesSupportHubPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("search");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  // Product Search State
  const [searchMode, setSearchMode] = useState<"quick" | "detailed">("quick");
  const [selectedModel, setSelectedModel] = useState<string>("Auto (default)");
  const [customerQuery, setCustomerQuery] = useState<string>("");
  const [detailedIndustry, setDetailedIndustry] =
    useState<string>("All Workflows");
  const [detailedDocFocus, setDetailedDocFocus] =
    useState<string>("All Documents");
  const [detailedSalesGoal, setDetailedSalesGoal] = useState<string>(
    "Complete Solution + Cross-sell"
  );
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [aiResult, setAiResult] = useState<AISuggestResponse | null>(null);
  const [historyList, setHistoryList] = useState<SearchHistoryItem[]>([]);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState<boolean>(false);
  const [showTemplatesMenu, setShowTemplatesMenu] = useState<boolean>(false);

  // Manage Products State
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [catalogView, setCatalogView] = useState<"active" | "trash">("active");
  const [catalogDisplayMode, setCatalogDisplayMode] = useState<
    "grid" | "list" | "table" | "board"
  >("grid");
  const [catalogSearch, setCatalogSearch] = useState<string>("");
  const [selectedCategory, setSelectedCategory] =
    useState<string>("All Categories");
  const [selectedStatus, setSelectedStatus] = useState<string>("All Statuses");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductCreatePayload>(EMPTY_FORM);
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);

  // Analytics State
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  // User Management State (Active / Inactive / Archived)
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState<boolean>(false);

  // Feedback banner
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleOpenUsersModal = async () => {
    if (user?.username !== "admin") {
      showToast("Access Restricted: Administrator role required to view team accounts.");
      return;
    }
    try {
      const users = await apiFetch<UserProfile[]>("/api/users");
      setUsersList(users);
      setIsUsersModalOpen(true);
    } catch (err: unknown) {
      setErrorBanner(
        err instanceof Error ? err.message : "Failed to load team users"
      );
    }
  };

  const handleUpdateUserStatus = async (
    targetUserId: number,
    newStatus: "active" | "inactive" | "archived"
  ) => {
    if (user?.username !== "admin") {
      showToast("Access Restricted: Administrator role required to change account status.");
      return;
    }
    try {
      await apiFetch<UserProfile>(`/api/users/${targetUserId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      showToast(`Updated user status to ${newStatus.toUpperCase()}`);
      const updated = await apiFetch<UserProfile[]>("/api/users");
      setUsersList(updated);
    } catch (err: unknown) {
      setErrorBanner(
        err instanceof Error ? err.message : "Failed to update user status"
      );
    }
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
  const executeSearchQuery = async (
    rawQuery: string,
    modeOverride?: "quick" | "detailed"
  ) => {
    const activeMode = modeOverride || searchMode;
    if (!rawQuery.trim() || rawQuery.trim().length < 2) {
      setErrorBanner(
        "Please describe what your customer needs (at least 2 characters)."
      );
      return;
    }
    setErrorBanner(null);
    setIsSearching(true);

    let finalQuery = rawQuery.trim();
    if (activeMode === "detailed") {
      const contextParts: string[] = [];
      if (detailedIndustry !== "All Workflows") {
        contextParts.push(`Industry/Workflow: ${detailedIndustry}`);
      }
      if (detailedDocFocus !== "All Documents") {
        contextParts.push(`Document Focus: ${detailedDocFocus}`);
      }
      if (detailedSalesGoal !== "Complete Solution + Cross-sell") {
        contextParts.push(`Sales Strategy: ${detailedSalesGoal}`);
      }
      if (contextParts.length > 0) {
        finalQuery = `${finalQuery} [${contextParts.join(" | ")}]`;
      }
    }

    try {
      const res = await apiFetch<AISuggestResponse>("/api/ai/suggest", {
        method: "POST",
        body: JSON.stringify({
          query: finalQuery,
          search_mode: activeMode,
          model: selectedModel,
        }),
      });
      setAiResult(res);
      const updatedHist = await apiFetch<SearchHistoryItem[]>(
        "/api/ai/history"
      );
      setHistoryList(updatedHist);
    } catch (err: unknown) {
      setErrorBanner(
        err instanceof Error ? err.message : "AI inference failed"
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleFindProducts = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeSearchQuery(customerQuery);
  };

  const handleImageFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingImage(true);
    setErrorBanner(null);
    try {
      const uploaded = await uploadProductImage(file);
      setFormData((prev) => ({ ...prev, image_url: uploaded.image_url }));
      showToast(`Uploaded image "${file.name}" successfully.`);
    } catch (err: unknown) {
      setErrorBanner(
        err instanceof Error ? err.message : "Failed to upload image file"
      );
    } finally {
      setIsUploadingImage(false);
      e.target.value = "";
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

  // --- Product Portfolio CRUD Handlers ---
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
    const matchesStatus =
      selectedStatus === "All Statuses" ||
      (p.status || "active") === selectedStatus;
    const q = catalogSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q);
    return matchesCategory && matchesStatus && matchesSearch;
  });

  const handleQuickStatusChange = async (
    product: Product,
    newStatus: "active" | "inactive" | "archived"
  ) => {
    try {
      await apiFetch<Product>(`/api/products/${product.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      showToast(
        `Updated "${product.name}" status to ${newStatus.toUpperCase()}`
      );
      await loadHubData();
    } catch (err: unknown) {
      setErrorBanner(
        err instanceof Error ? err.message : "Failed to update product status"
      );
    }
  };

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
      status: product.status || "active",
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
      showToast(
        `Moved "${product.name}" to Trash. You can restore it anytime.`
      );
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
      showToast(`Restored "${product.name}" back to Active Catalog.`);
      await loadHubData();
    } catch (err: unknown) {
      setErrorBanner(
        err instanceof Error ? err.message : "Failed to restore product"
      );
    }
  };

  // Permanent Delete & Empty Trash
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<{
    isOpen: boolean;
    product?: Product;
    isEmptyTrash?: boolean;
  }>({ isOpen: false });

  const handlePermanentDelete = async (product: Product) => {
    try {
      await apiFetch(`/api/products/${product.id}/permanent`, {
        method: "DELETE",
      });
      showToast(`Permanently purged "${product.name}" from database.`);
      setPermanentDeleteTarget({ isOpen: false });
      await loadHubData();
    } catch (err: unknown) {
      setErrorBanner(
        err instanceof Error
          ? err.message
          : "Failed to permanently delete product"
      );
    }
  };

  const handleEmptyTrash = async () => {
    try {
      await apiFetch(`/api/products/trash/empty`, { method: "DELETE" });
      showToast(`All soft-deleted products permanently purged from trash.`);
      setPermanentDeleteTarget({ isOpen: false });
      await loadHubData();
    } catch (err: unknown) {
      setErrorBanner(
        err instanceof Error ? err.message : "Failed to empty trash"
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
        err instanceof Error
          ? err.message
          : "Failed to delete selected products"
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-20">
      {/* ============================================================ */}
      {/* 21ST.DEV WHITE CLEAN FLOATING TUBELIGHT NAVBAR               */}
      {/* ============================================================ */}
      <TubelightNavbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        activeProductsCount={activeProducts.length}
        user={user}
        expiresAt={expiresAt}
        onOpenUsersModal={handleOpenUsersModal}
        onLogout={handleLogout}
      />

      {/* ============================================================ */}
      {/* MAIN WORKSPACE CONTAINER                                     */}
      {/* ============================================================ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-5">
        {/* Notifications */}
        {errorBanner && (
          <div
            role="alert"
            className="mb-5 flex items-center justify-between rounded-lg bg-red-50/90 border border-red-200 px-4 py-3 text-xs sm:text-sm font-medium text-red-800 shadow-2xs"
          >
            <span className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              {errorBanner}
            </span>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              className="text-red-500 hover:text-red-800 p-1 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {toastMessage && (
          <div
            role="status"
            className="mb-5 flex items-center gap-2.5 rounded-lg bg-zinc-900 text-white px-4 py-3 text-xs sm:text-sm font-medium shadow-md"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {/* ============================================================ */}
            {/* TAB 1: PRODUCT SEARCH                                        */}
            {/* ============================================================ */}
            {activeTab === "search" && (
              <div className="space-y-6">
            {/* Search Composer Surface */}
            <div className="bg-white rounded-xl border border-zinc-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
              {/* Top Composer Toolbar */}
              <div className="px-5 py-3.5 bg-zinc-50/70 border-b border-zinc-200/80 flex flex-wrap items-center justify-between gap-3">
                {/* Mode Segmented Control with 21st.dev Animated Sliding Pill */}
                <div className="inline-flex bg-slate-100/90 p-1 rounded-full border border-slate-200/80 relative">
                  <button
                    type="button"
                    onClick={() => setSearchMode("quick")}
                    className={`relative inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors z-10 ${
                      searchMode === "quick"
                        ? "text-slate-950 font-semibold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {searchMode === "quick" && (
                      <motion.span
                        layoutId="search-mode-pill"
                        className="absolute inset-0 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] border border-slate-200/70 -z-10"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      />
                    )}
                    <Zap
                      className={`w-3.5 h-3.5 ${
                        searchMode === "quick"
                          ? "text-emerald-600"
                          : "text-slate-400"
                      }`}
                    />
                    <span>Quick Search</span>
                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 border border-slate-200/60">
                      &lt;50ms
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSearchMode("detailed")}
                    className={`relative inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors z-10 ${
                      searchMode === "detailed"
                        ? "text-slate-950 font-semibold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {searchMode === "detailed" && (
                      <motion.span
                        layoutId="search-mode-pill"
                        className="absolute inset-0 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] border border-slate-200/70 -z-10"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      />
                    )}
                    <SlidersHorizontal
                      className={`w-3.5 h-3.5 ${
                        searchMode === "detailed"
                          ? "text-blue-600"
                          : "text-slate-400"
                      }`}
                    />
                    <span>Detailed Search</span>
                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 border border-slate-200/60">
                      AI LLM
                    </span>
                  </button>
                </div>

                {/* Right Toolbar Controls: Engine / Model / History / Templates */}
                <div className="flex flex-wrap items-center gap-2">
                  {searchMode === "detailed" ? (
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="model-select"
                        className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 flex items-center gap-1"
                      >
                        <Cpu className="w-3.5 h-3.5 text-zinc-400" />
                        Model:
                      </label>
                      <select
                        id="model-select"
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-mono text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                      >
                        <option value="Auto (default)">
                          Auto Fast (Cohere North Mini ~3s)
                        </option>
                        <option value="cohere/north-mini-code:free">
                          cohere/north-mini-code:free (~3s)
                        </option>
                        <option value="apodex/apodex-1.1-mini:free">
                          apodex/apodex-1.1-mini:free (~5s)
                        </option>
                        <option value="google/gemma-4-26b-a4b-it:free">
                          google/gemma-4-26b-a4b-it:free
                        </option>
                        <option value="openai/gpt-4o-mini">
                          openai/gpt-4o-mini
                        </option>
                        <option value="google/gemini-2.5-flash">
                          google/gemini-2.5-flash
                        </option>
                      </select>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-zinc-200/80 text-zinc-600 text-[11px] font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      ENGINE: DETERMINISTIC_MATCHER
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setShowHistoryDrawer((v) => !v);
                      setShowTemplatesMenu(false);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                      showHistoryDrawer
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700"
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>History</span>
                    <span className="font-mono text-[11px] opacity-75">
                      ({historyList.length})
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowTemplatesMenu((v) => !v);
                      setShowHistoryDrawer(false);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                      showTemplatesMenu
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700"
                    }`}
                  >
                    <BookTemplate className="w-3.5 h-3.5" />
                    <span>Templates</span>
                  </button>
                </div>
              </div>

              {/* Mode-Specific Secondary Bar */}
              {searchMode === "quick" ? (
                <div className="px-5 py-3 bg-zinc-50/30 border-b border-zinc-100 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 mr-1 flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    Instant Tags:
                  </span>
                  {Array.from(
                    new Set(activeProducts.map((p) => p.category))
                  ).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setCustomerQuery(cat);
                        executeSearchQuery(cat, "quick");
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-white border border-zinc-200/90 text-zinc-700 hover:border-zinc-900 hover:text-zinc-950 transition shadow-2xs"
                    >
                      <Layers className="w-3 h-3 text-zinc-400" />
                      <span>{cat}</span>
                    </button>
                  ))}
                  {[...activeProducts]
                    .reverse()
                    .slice(0, 4)
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setCustomerQuery(p.name);
                          executeSearchQuery(p.name, "quick");
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-zinc-100/80 border border-zinc-200/60 text-zinc-600 hover:bg-white hover:border-zinc-400 hover:text-zinc-950 transition"
                      >
                        <Box className="w-3 h-3 text-zinc-400" />
                        <span className="max-w-[180px] truncate">{p.name}</span>
                      </button>
                    ))}
                </div>
              ) : (
                <div className="px-5 py-4 bg-zinc-50/40 border-b border-zinc-200/70">
                  <div className="grid sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-1.5">
                        01 / Target Workflow &amp; Industry
                      </label>
                      <select
                        value={detailedIndustry}
                        onChange={(e) => setDetailedIndustry(e.target.value)}
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                      >
                        <option value="All Workflows">
                          All Workflows (General Bioprocess &amp; Lab)
                        </option>
                        <option value="GMP Bioprocessing & mAb Purification">
                          GMP Bioprocessing &amp; mAb Purification
                        </option>
                        <option value="Sterile Filtration & Buffer Prep">
                          Sterile Filtration &amp; Buffer Prep
                        </option>
                        <option value="Quality Control & Microbial Analysis">
                          Quality Control &amp; Microbial Analysis
                        </option>
                        <option value="Laboratory R&D & Cell Harvesting">
                          Laboratory R&amp;D &amp; Cell Harvesting
                        </option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-1.5">
                        02 / Documentation Priority
                      </label>
                      <select
                        value={detailedDocFocus}
                        onChange={(e) => setDetailedDocFocus(e.target.value)}
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                      >
                        <option value="All Documents">
                          All Documentation (Validation + Literature)
                        </option>
                        <option value="GMP Validation & Extractables Reports">
                          GMP Validation &amp; Extractables Reports
                        </option>
                        <option value="Peer-Reviewed Publications & App Notes">
                          Peer-Reviewed Publications &amp; App Notes
                        </option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-1.5">
                        03 / Commercial Strategy
                      </label>
                      <select
                        value={detailedSalesGoal}
                        onChange={(e) => setDetailedSalesGoal(e.target.value)}
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                      >
                        <option value="Complete Solution + Cross-sell">
                          Complete Workflow Solution + Cross-Sell
                        </option>
                        <option value="Direct Technical Spec Match">
                          Direct Technical Specification Match
                        </option>
                        <option value="Turnaround Speed & Cost Efficiency">
                          Turnaround Speed &amp; Cost Efficiency
                        </option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Optional Templates Popover */}
              {showTemplatesMenu && (
                <div className="px-5 py-4 bg-zinc-50 border-b border-zinc-200/80">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-2.5">
                    Select Standard Customer Inquiry Template
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {SEARCH_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.label}
                        type="button"
                        onClick={() => {
                          setCustomerQuery(tpl.query);
                          setShowTemplatesMenu(false);
                        }}
                        className="text-left p-3 rounded-lg bg-white border border-zinc-200/90 hover:border-zinc-900 transition shadow-2xs group"
                      >
                        <div className="text-xs font-semibold text-zinc-950 flex items-center justify-between">
                          <span>{tpl.label}</span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-900 transition" />
                        </div>
                        <div className="text-xs text-zinc-500 line-clamp-2 mt-1 leading-relaxed">
                          {tpl.query}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Optional History Drawer */}
              {showHistoryDrawer && (
                <div className="px-5 py-4 bg-zinc-50 border-b border-zinc-200/80 max-h-56 overflow-y-auto">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-2.5">
                    Recent Search Queries
                  </div>
                  <div className="space-y-1.5">
                    {historyList.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setCustomerQuery(item.query);
                          setShowHistoryDrawer(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg bg-white border border-zinc-200/80 hover:border-zinc-400 flex items-center justify-between gap-3 transition"
                      >
                        <span className="text-xs text-zinc-800 truncate font-medium">
                          {item.query}
                        </span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 shrink-0">
                          {item.model_used}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Main Query Input & Composer Footer */}
              <form onSubmit={handleFindProducts} className="p-5">
                <textarea
                  rows={searchMode === "quick" ? 2 : 3}
                  data-testid="search-query-input"
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  placeholder={
                    searchMode === "quick"
                      ? "Search by product name, brand, SKU category, or technical keyword (Thai or English)..."
                      : "Describe the customer's bioprocess workflow, regulatory requirements, scale, or technical challenge for deep AI synthesis..."
                  }
                  className="w-full rounded-lg bg-zinc-50/50 border border-zinc-200 px-4 py-3 text-sm text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 focus:bg-white transition resize-none"
                />

                <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-zinc-500 flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        searchMode === "quick"
                          ? "bg-emerald-500"
                          : "bg-blue-600"
                      }`}
                    />
                    <span>
                      {searchMode === "quick"
                        ? "Instant deterministic catalog lookup (<50ms response)"
                        : "Deep OpenRouter LLM reasoning with validation docs & cross-sell matrix"}
                    </span>
                  </div>

                  <button
                    type="submit"
                    data-testid="find-products-button"
                    disabled={isSearching}
                    className="px-5 py-2.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white font-medium text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-2xs"
                  >
                    {searchMode === "quick" ? (
                      <Zap className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    )}
                    <span>
                      {isSearching
                        ? searchMode === "quick"
                          ? "Matching Catalog..."
                          : "Running AI Synthesis..."
                        : searchMode === "quick"
                        ? "Find Products (Instant)"
                        : "Run AI Analysis"}
                    </span>
                  </button>
                </div>
              </form>
            </div>

            {/* Active Catalog Quick-Test Strip */}
            {activeProducts.length > 0 && (
              <div className="bg-white rounded-xl border border-zinc-200/90 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-zinc-500">
                      Active Portfolio Strip ({activeProducts.length} SKUs)
                    </span>
                    <span className="text-zinc-300">•</span>
                    <span className="text-xs text-zinc-500">
                      Click any item to test search matching &amp; inspect product imagery
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("manage");
                      openAddModal();
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 transition shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Product</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {[...activeProducts].reverse().map((prod) => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => {
                        setCustomerQuery(
                          `${prod.name} (${prod.brand}) - ${prod.category}`
                        );
                        executeSearchQuery(
                          `${prod.name} ${prod.brand} ${prod.category}`
                        );
                      }}
                      className="group text-left rounded-xl border border-slate-200/90 overflow-hidden bg-white hover:border-slate-300 hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 flex flex-col shadow-2xs"
                    >
                      <div className="w-full h-28 bg-slate-100 relative overflow-hidden border-b border-slate-100 flex items-center justify-center">
                        <Package className="w-6 h-6 text-slate-300" />
                        {prod.image_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={prod.image_url}
                            alt={prod.name}
                            className="w-full h-full object-cover absolute inset-0 group-hover:scale-108 transition-transform duration-500 ease-out"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : null}
                        <span className="absolute bottom-2 left-2 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-white/95 text-slate-800 border border-slate-200/80 shadow-2xs backdrop-blur-md">
                          {prod.brand}
                        </span>
                      </div>
                      <div className="p-2.5">
                        <div className="text-xs font-semibold text-zinc-900 line-clamp-1 group-hover:text-blue-600 transition">
                          {prod.name}
                        </div>
                        <div className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">
                          {prod.category}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* AI Recommendation Results */}
            {aiResult && (
              <div
                data-testid="ai-results-section"
                className="space-y-6 animate-fadeIn"
              >
                {/* Executive Summary Callout */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider font-semibold text-blue-700 bg-blue-50/80 px-3 py-1 rounded-full border border-blue-200/60">
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        Synthesis Summary
                      </span>
                      <span className="text-xs font-mono text-slate-500">
                        {aiResult.model_used}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleExportResults}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-950 border border-slate-200 rounded-full px-3.5 py-1.5 hover:bg-slate-50 transition shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export JSON</span>
                    </button>
                  </div>
                  <p className="text-sm sm:text-[15px] text-slate-700 leading-relaxed">
                    {aiResult.executive_summary}
                  </p>
                </div>

                {/* Feature 1: Product Suggestion */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-5 pb-3 border-b border-slate-100">
                    <div>
                      <span className="text-[11px] font-mono uppercase tracking-wider text-blue-600 font-semibold block mb-0.5">
                        01 / Catalog Match Matrix
                      </span>
                      <h3 className="text-base sm:text-lg font-semibold text-slate-950">
                        Product Suggestion — Recommended SKUs
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500">
                      Ranked by technical specification alignment &amp; workflow fit
                    </p>
                  </div>

                  <div className="grid md:grid-cols-3 gap-5">
                    {aiResult.suggested_products.map((prod, idx) => (
                      <div
                        key={`${prod.name}-${idx}`}
                        className="rounded-xl border border-slate-200/80 overflow-hidden flex flex-col justify-between bg-white hover:border-slate-300 hover:shadow-md transition shadow-2xs group"
                      >
                        <div>
                          {/* Product Image Header */}
                          {prod.image_url ? (
                            <div className="w-full h-44 bg-slate-100 overflow-hidden relative border-b border-slate-100">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={prod.image_url}
                                alt={prod.name}
                                loading="lazy"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display =
                                    "none";
                                }}
                              />
                              <div className="absolute top-3 left-3">
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold px-2.5 py-1 rounded-full bg-white/95 text-slate-900 border border-slate-200/80 shadow-xs backdrop-blur-md">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  {prod.match_score}% MATCH
                                </span>
                              </div>
                              <div className="absolute top-3 right-3">
                                <span className="text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-white/95 text-slate-800 border border-slate-200/80 shadow-2xs backdrop-blur-md">
                                  {prod.brand}
                                </span>
                              </div>
                            </div>
                          ) : null}

                          <div className="p-5">
                            {!prod.image_url && (
                              <div className="flex items-center justify-between gap-2 mb-3">
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  {prod.match_score}% MATCH
                                </span>
                                <span className="text-[11px] font-mono text-slate-500 uppercase">
                                  {prod.brand}
                                </span>
                              </div>
                            )}
                            <div className="text-[11px] font-mono text-blue-600 uppercase tracking-wider mb-1">
                              {prod.category} • {prod.sub_type}
                            </div>
                            <h4 className="font-semibold text-zinc-950 text-base leading-snug">
                              {prod.name}
                            </h4>
                            <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed mt-2.5">
                              {prod.reasoning}
                            </p>
                          </div>
                        </div>

                        {prod.key_benefits && prod.key_benefits.length > 0 && (
                          <div className="px-5 pb-5">
                            <ul className="space-y-1.5 border-t border-zinc-100 pt-3.5 text-xs text-zinc-600">
                              {prod.key_benefits.map((b, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                  <span>{b}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Feature 2 & Feature 3 Grid: Supporting Documents & Cross-selling */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Feature 2: Supporting Documents */}
                  <div className="bg-white rounded-xl border border-zinc-200/90 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                    <div className="mb-4 pb-3 border-b border-zinc-100">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 font-semibold block mb-0.5">
                        02 / Regulatory &amp; Technical Evidence
                      </span>
                      <h3 className="text-base sm:text-lg font-semibold text-zinc-950 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-zinc-700" />
                        <span>Supporting Documents &amp; Validation</span>
                      </h3>
                    </div>

                    <div className="space-y-3">
                      {aiResult.supporting_documents.map((doc, idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-lg bg-zinc-50/70 hover:bg-white border border-zinc-200/80 hover:border-zinc-300 transition"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                            <span className="text-[11px] font-mono font-medium uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/60">
                              {doc.doc_type}
                            </span>
                            <span className="text-[11px] font-mono text-zinc-500">
                              Ref: {doc.related_product}
                            </span>
                          </div>
                          <div className="text-sm font-semibold text-zinc-950 mt-1">
                            {doc.title}
                          </div>
                          <p className="text-xs sm:text-sm text-zinc-600 mt-1 leading-relaxed">
                            {doc.relevance}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Feature 3: Cross-selling */}
                  <div className="bg-white rounded-xl border border-zinc-200/90 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                    <div className="mb-4 pb-3 border-b border-zinc-100">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 font-semibold block mb-0.5">
                        03 / Companion Workflow Expansion
                      </span>
                      <h3 className="text-base sm:text-lg font-semibold text-zinc-950 flex items-center gap-2">
                        <GitBranchPlus className="w-4 h-4 text-zinc-700" />
                        <span>Cross-selling &amp; Companion Products</span>
                      </h3>
                    </div>

                    <div className="space-y-3">
                      {aiResult.cross_selling.map((cs, idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-lg bg-zinc-50/70 hover:bg-white border border-zinc-200/80 hover:border-zinc-300 transition"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                            <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-zinc-200/70 text-zinc-800">
                              {cs.category}
                            </span>
                            <span className="text-[11px] font-mono text-zinc-500">
                              Pair with: {cs.paired_with}
                            </span>
                          </div>
                          <div className="text-sm font-semibold text-zinc-950 mt-1">
                            {cs.product_name}
                          </div>
                          <p className="text-xs sm:text-sm text-zinc-600 mt-1 leading-relaxed">
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
        {/* TAB 2: MANAGE PRODUCTS                                       */}
        {/* ============================================================ */}
        {activeTab === "manage" && (
          <div className="bg-white rounded-xl border border-zinc-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] p-6 sm:p-7">
            {/* Top Header & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-5 border-b border-zinc-100">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-zinc-950 tracking-tight">
                  Product Portfolio Management
                </h2>
                <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
                  Maintain SKUs, technical descriptions, and lifecycle states for AI grounding.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {catalogView === "trash" && trashProducts.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setPermanentDeleteTarget({
                        isOpen: true,
                        isEmptyTrash: true,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 px-3 py-2 text-xs font-medium transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Empty Trash ({trashProducts.length})</span>
                  </button>
                )}
                {selectedIds.length > 0 && catalogView === "active" && (
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white px-3 py-2 text-xs font-medium transition shadow-2xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Move Selected to Trash ({selectedIds.length})</span>
                  </button>
                )}
                <button
                  type="button"
                  data-testid="add-product-button"
                  onClick={openAddModal}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white px-3.5 py-2 text-xs sm:text-sm font-medium transition shadow-2xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Product</span>
                </button>
              </div>
            </div>

            {/* Catalog Subheader & Filter Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 mb-5">
              <div className="flex flex-wrap items-center gap-3">
                <h3
                  data-testid="catalog-count-heading"
                  className="text-sm font-semibold text-zinc-900 font-mono"
                >
                  Product Catalog ({filteredProducts.length} of{" "}
                  {catalogView === "active"
                    ? activeProducts.length
                    : trashProducts.length}{" "}
                  products)
                </h3>

                {/* Active vs Trash View Toggle */}
                <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/80 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setCatalogView("active");
                      setSelectedIds([]);
                    }}
                    className={`px-3 py-1.5 rounded-lg font-medium transition ${
                      catalogView === "active"
                        ? "bg-white text-slate-900 shadow-2xs font-semibold"
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
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                      catalogView === "trash"
                        ? "bg-white text-red-600 shadow-2xs font-semibold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Trash ({trashProducts.length})</span>
                  </button>
                </div>
              </div>

              {/* Search & Selects */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative flex-1 sm:w-64 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Filter by name, brand, spec..."
                    className="w-full rounded-xl bg-slate-50/80 border border-slate-200 pl-8 pr-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    aria-label="Filter by category"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="rounded-xl bg-slate-50/80 border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <select
                  aria-label="Filter by status"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="rounded-xl bg-slate-50/80 border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="All Statuses">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                  <option value="archived">Archived Only</option>
                </select>
              </div>
            </div>

            {/* View Switcher Bar & Bulk Selection */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center gap-2.5 text-xs font-medium text-slate-700">
                <input
                  id="select-all-products"
                  type="checkbox"
                  checked={
                    filteredProducts.length > 0 &&
                    selectedIds.length === filteredProducts.length
                  }
                  onChange={(e) => handleToggleSelectAll(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="select-all-products" className="cursor-pointer select-none">
                  Select all visible ({filteredProducts.length})
                </label>
                {selectedIds.length > 0 && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">
                    {selectedIds.length} selected
                  </span>
                )}
              </div>

              {/* 21st.dev Layout Switcher Pill */}
              <div className="inline-flex items-center rounded-xl bg-white p-1 border border-slate-200/80 shadow-2xs self-start sm:self-auto">
                {(
                  [
                    { id: "grid", label: "Gallery", icon: LayoutGrid },
                    { id: "list", label: "List", icon: List },
                    { id: "table", label: "Table", icon: Table },
                    { id: "board", label: "Board", icon: Columns3 },
                  ] as const
                ).map((mode) => {
                  const Icon = mode.icon;
                  const isActive = catalogDisplayMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setCatalogDisplayMode(mode.id)}
                      className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        isActive
                          ? "text-slate-900 font-semibold"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="catalog-view-pill"
                          className="absolute inset-0 bg-slate-100 rounded-lg shadow-2xs"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                      <Icon className="w-3.5 h-3.5 relative z-10" />
                      <span className="relative z-10">{mode.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Empty State */}
            {filteredProducts.length === 0 && (
              <div className="text-center py-16 text-xs sm:text-sm text-slate-500 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-medium text-slate-700">No matching products found</p>
                <p className="text-xs text-slate-400 mt-1">Try adjusting your search query, category, or status filter.</p>
              </div>
            )}

            {/* VIEW 1: GALLERY GRID */}
            {filteredProducts.length > 0 && catalogDisplayMode === "grid" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    data-testid={`product-card-${product.id}`}
                    className="group rounded-2xl border border-slate-200/90 bg-white p-4 flex flex-col justify-between hover:shadow-lg hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div>
                      {/* Card Header: Checkbox + Status Selector */}
                      <div className="flex items-center justify-between gap-2 mb-3">
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
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />

                        <select
                          aria-label={`Change status of ${product.name}`}
                          value={product.status || "active"}
                          onChange={(e) =>
                            handleQuickStatusChange(
                              product,
                              e.target.value as "active" | "inactive" | "archived"
                            )
                          }
                          className={`text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded-full border cursor-pointer focus:outline-none transition ${
                            (product.status || "active") === "active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200/80"
                              : (product.status || "active") === "inactive"
                              ? "bg-amber-50 text-amber-700 border-amber-200/80"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="archived">Archived</option>
                        </select>
                      </div>

                      {/* Photo Thumbnail */}
                      <div className="w-full h-36 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center relative mb-3 group-hover:bg-slate-100/70 transition">
                        <Package className="w-8 h-8 text-slate-300" />
                        {product.image_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover absolute inset-0 group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : null}
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/70">
                          {product.brand}
                        </span>
                        <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60">
                          {product.category}
                        </span>
                      </div>

                      {/* Product Title */}
                      <h4 className="font-semibold text-slate-900 text-sm line-clamp-1 group-hover:text-blue-600 transition-colors">
                        {product.name}
                      </h4>

                      {/* Description */}
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {product.description}
                      </p>
                    </div>

                    {/* Bottom Metadata & Actions */}
                    <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono text-slate-400 truncate">
                        {product.type || "standard"}
                      </span>

                      <div className="flex items-center gap-1 shrink-0">
                        {product.is_deleted ? (
                          <>
                            <button
                              type="button"
                              aria-label={`Restore ${product.name}`}
                              data-testid={`restore-product-${product.name}`}
                              onClick={() => handleRestoreProduct(product)}
                              className="p-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                              title="Restore product"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete Permanently ${product.name}`}
                              data-testid={`permanent-delete-product-${product.name}`}
                              onClick={() =>
                                setPermanentDeleteTarget({
                                  isOpen: true,
                                  product,
                                })
                              }
                              className="p-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 transition"
                              title="Delete permanently"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              aria-label={`Edit ${product.name}`}
                              data-testid={`edit-product-${product.name}`}
                              onClick={() => openEditModal(product)}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition"
                              title="Edit product"
                            >
                              <SquarePen className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete ${product.name}`}
                              data-testid={`delete-product-${product.name}`}
                              onClick={() => handleDeleteProduct(product)}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-50 transition"
                              title="Move to trash"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* VIEW 2: COMPACT LIST */}
            {filteredProducts.length > 0 && catalogDisplayMode === "list" && (
              <div className="space-y-2.5">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    data-testid={`product-card-${product.id}`}
                    className="rounded-xl border border-slate-200/90 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-300 hover:shadow-xs transition bg-white"
                  >
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
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
                        className="mt-1 sm:mt-0 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                      />

                      <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center shrink-0 text-slate-400 relative">
                        <Package className="w-5 h-5 text-slate-300" />
                        {product.image_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover absolute inset-0"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : null}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-semibold text-slate-900 text-sm sm:text-base">
                            {product.name}
                          </h4>
                          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200/60">
                            {product.brand}
                          </span>
                          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/50">
                            {product.category}
                          </span>
                          <select
                            aria-label={`Change status of ${product.name}`}
                            value={product.status || "active"}
                            onChange={(e) =>
                              handleQuickStatusChange(
                                product,
                                e.target.value as "active" | "inactive" | "archived"
                              )
                            }
                            className={`text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded border cursor-pointer focus:outline-none transition ${
                              (product.status || "active") === "active"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : (product.status || "active") === "inactive"
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            <option value="active">STATUS: ACTIVE</option>
                            <option value="inactive">STATUS: INACTIVE</option>
                            <option value="archived">STATUS: ARCHIVED</option>
                          </select>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                          {product.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      {product.is_deleted ? (
                        <>
                          <button
                            type="button"
                            aria-label={`Restore ${product.name}`}
                            data-testid={`restore-product-${product.name}`}
                            onClick={() => handleRestoreProduct(product)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-medium text-xs transition"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Restore</span>
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete Permanently ${product.name}`}
                            data-testid={`permanent-delete-product-${product.name}`}
                            onClick={() =>
                              setPermanentDeleteTarget({
                                isOpen: true,
                                product,
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 font-medium text-xs transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete Permanently</span>
                          </button>
                        </>
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
              </div>
            )}

            {/* VIEW 3: ENTERPRISE DATA TABLE */}
            {filteredProducts.length > 0 && catalogDisplayMode === "table" && (
              <div className="rounded-xl border border-slate-200/90 overflow-hidden bg-white shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-mono uppercase text-slate-500">
                      <tr>
                        <th className="p-3.5 w-10 text-center">
                          <span className="sr-only">Select</span>
                        </th>
                        <th className="p-3.5">Product</th>
                        <th className="p-3.5">Category</th>
                        <th className="p-3.5">Brand</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredProducts.map((product) => (
                        <tr
                          key={product.id}
                          data-testid={`product-card-${product.id}`}
                          className="hover:bg-slate-50/80 transition"
                        >
                          <td className="p-3.5 text-center">
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
                              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center shrink-0 relative text-slate-300">
                                <Package className="w-4 h-4" />
                                {product.image_url ? (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img
                                    src={product.image_url}
                                    alt={product.name}
                                    className="w-full h-full object-cover absolute inset-0"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = "none";
                                    }}
                                  />
                                ) : null}
                              </div>
                              <div className="min-w-0 max-w-xs sm:max-w-md">
                                <div className="font-semibold text-slate-900 truncate">
                                  {product.name}
                                </div>
                                <div className="text-slate-500 text-[11px] truncate">
                                  {product.description}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5 font-mono text-[11px] text-slate-600">
                            {product.category}
                          </td>
                          <td className="p-3.5 font-mono text-[11px] text-slate-600">
                            {product.brand}
                          </td>
                          <td className="p-3.5">
                            <select
                              aria-label={`Change status of ${product.name}`}
                              value={product.status || "active"}
                              onChange={(e) =>
                                handleQuickStatusChange(
                                  product,
                                  e.target.value as "active" | "inactive" | "archived"
                                )
                              }
                              className={`text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded border cursor-pointer focus:outline-none transition ${
                                (product.status || "active") === "active"
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : (product.status || "active") === "inactive"
                                  ? "bg-amber-50 text-amber-800 border-amber-200"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}
                            >
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                              <option value="archived">Archived</option>
                            </select>
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {product.is_deleted ? (
                                <>
                                  <button
                                    type="button"
                                    aria-label={`Restore ${product.name}`}
                                    data-testid={`restore-product-${product.name}`}
                                    onClick={() => handleRestoreProduct(product)}
                                    className="p-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={`Delete Permanently ${product.name}`}
                                    data-testid={`permanent-delete-product-${product.name}`}
                                    onClick={() =>
                                      setPermanentDeleteTarget({
                                        isOpen: true,
                                        product,
                                      })
                                    }
                                    className="p-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 transition"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    aria-label={`Edit ${product.name}`}
                                    data-testid={`edit-product-${product.name}`}
                                    onClick={() => openEditModal(product)}
                                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition"
                                  >
                                    <SquarePen className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={`Delete ${product.name}`}
                                    data-testid={`delete-product-${product.name}`}
                                    onClick={() => handleDeleteProduct(product)}
                                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-50 transition"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VIEW 4: KANBAN LIFECYCLE BOARD */}
            {filteredProducts.length > 0 && catalogDisplayMode === "board" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {(
                  [
                    {
                      id: "active",
                      title: "Active Lifecycle",
                      badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
                      dot: "bg-emerald-500",
                    },
                    {
                      id: "inactive",
                      title: "Inactive / Staged",
                      badge: "bg-amber-50 text-amber-700 border-amber-200",
                      dot: "bg-amber-500",
                    },
                    {
                      id: "archived",
                      title: "Archived / End of Life",
                      badge: "bg-slate-100 text-slate-700 border-slate-200",
                      dot: "bg-slate-400",
                    },
                  ] as const
                ).map((col) => {
                  const colProducts = filteredProducts.filter(
                    (p) => (p.status || "active") === col.id
                  );
                  return (
                    <div
                      key={col.id}
                      className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 flex flex-col min-h-[420px]"
                    >
                      {/* Column Header */}
                      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/80">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                          <h4 className="font-semibold text-xs text-slate-800">
                            {col.title}
                          </h4>
                        </div>
                        <span
                          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${col.badge}`}
                        >
                          {colProducts.length}
                        </span>
                      </div>

                      {/* Cards Stack */}
                      <div className="space-y-3 flex-1 overflow-y-auto max-h-[680px] pr-1">
                        {colProducts.map((product) => (
                          <div
                            key={product.id}
                            data-testid={`product-card-${product.id}`}
                            className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs hover:shadow-md transition flex flex-col justify-between gap-3"
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2 mb-2">
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
                                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />

                                <select
                                  aria-label={`Change status of ${product.name}`}
                                  value={product.status || "active"}
                                  onChange={(e) =>
                                    handleQuickStatusChange(
                                      product,
                                      e.target.value as "active" | "inactive" | "archived"
                                    )
                                  }
                                  className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-700 cursor-pointer focus:outline-none"
                                >
                                  <option value="active">Active</option>
                                  <option value="inactive">Inactive</option>
                                  <option value="archived">Archived</option>
                                </select>
                              </div>

                              <div className="flex items-center gap-2.5 mb-2">
                                <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center shrink-0 relative text-slate-300">
                                  <Package className="w-4 h-4" />
                                  {product.image_url ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                      src={product.image_url}
                                      alt={product.name}
                                      className="w-full h-full object-cover absolute inset-0"
                                      onError={(e) => {
                                        (e.target as HTMLElement).style.display = "none";
                                      }}
                                    />
                                  ) : null}
                                </div>
                                <div className="min-w-0">
                                  <h5 className="font-semibold text-xs text-slate-900 truncate">
                                    {product.name}
                                  </h5>
                                  <div className="text-[10px] font-mono text-slate-400">
                                    {product.brand} • {product.category}
                                  </div>
                                </div>
                              </div>

                              <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                                {product.description}
                              </p>
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-1.5">
                              {product.is_deleted ? (
                                <>
                                  <button
                                    type="button"
                                    aria-label={`Restore ${product.name}`}
                                    data-testid={`restore-product-${product.name}`}
                                    onClick={() => handleRestoreProduct(product)}
                                    className="p-1 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={`Delete Permanently ${product.name}`}
                                    data-testid={`permanent-delete-product-${product.name}`}
                                    onClick={() =>
                                      setPermanentDeleteTarget({
                                        isOpen: true,
                                        product,
                                      })
                                    }
                                    className="p-1 rounded-md border border-red-200 bg-white hover:bg-red-50 text-red-600 transition"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    aria-label={`Edit ${product.name}`}
                                    data-testid={`edit-product-${product.name}`}
                                    onClick={() => openEditModal(product)}
                                    className="p-1.5 rounded-md border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition"
                                  >
                                    <SquarePen className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={`Delete ${product.name}`}
                                    data-testid={`delete-product-${product.name}`}
                                    onClick={() => handleDeleteProduct(product)}
                                    className="p-1.5 rounded-md border border-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-50 transition"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}

                        {colProducts.length === 0 && (
                          <div className="text-center py-10 text-[11px] text-slate-400 border border-dashed border-slate-200 rounded-xl bg-white/50">
                            No products in this stage
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: ANALYTICS DASHBOARD                                   */}
        {/* ============================================================ */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-zinc-200/90 p-5 shadow-2xs">
                <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                  Active Catalog SKUs
                </div>
                <div className="text-3xl font-mono font-bold text-zinc-950 mt-2">
                  {analytics?.total_products ?? activeProducts.length}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-zinc-200/90 p-5 shadow-2xs">
                <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                  Total AI Queries
                </div>
                <div className="text-3xl font-mono font-bold text-blue-600 mt-2">
                  {analytics?.total_searches ?? historyList.length}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-zinc-200/90 p-5 shadow-2xs">
                <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                  Validation Reports Indexed
                </div>
                <div className="text-3xl font-mono font-bold text-zinc-950 mt-2">
                  {analytics?.total_supporting_documents ?? 6}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-zinc-200/90 p-5 shadow-2xs">
                <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                  Cross-Sell Pairings
                </div>
                <div className="text-3xl font-mono font-bold text-emerald-600 mt-2">
                  {analytics?.total_cross_sell_links ?? 6}
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-zinc-200/90 p-6 shadow-2xs">
                <h3 className="text-sm font-semibold text-zinc-950 uppercase font-mono tracking-wider mb-5">
                  Portfolio Distribution by Category
                </h3>
                <div className="space-y-4">
                  {(analytics?.categories_breakdown ?? []).map((item) => (
                    <div key={item.category}>
                      <div className="flex justify-between text-xs font-medium text-zinc-700 mb-1.5">
                        <span>{item.category}</span>
                        <span className="font-mono text-zinc-500">
                          {item.count} SKU(s)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-zinc-900 rounded-full"
                          style={{
                            width: `${Math.min(
                              100,
                              (item.count /
                                Math.max(1, activeProducts.length)) *
                                100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-zinc-200/90 p-6 shadow-2xs">
                <h3 className="text-sm font-semibold text-zinc-950 uppercase font-mono tracking-wider mb-5">
                  Portfolio Distribution by Brand
                </h3>
                <div className="space-y-2.5">
                  {(analytics?.brands_breakdown ?? []).map((item) => (
                    <div
                      key={item.brand}
                      className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-zinc-50 border border-zinc-200/80 text-xs"
                    >
                      <span className="font-semibold text-zinc-900">
                        {item.brand}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white border border-zinc-200 text-zinc-700 font-mono">
                        {item.count} item(s)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ============================================================ */}
      {/* MODAL: ADD / EDIT PRODUCT                                    */}
      {/* ============================================================ */}
      <AnimatePresence>
        {isModalOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 p-6 sm:p-7 relative z-10"
            >
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setIsModalOpen(false)}
                className="absolute right-5 top-5 text-slate-400 hover:text-slate-800 p-1.5 rounded-full hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>

              <h2
                id="modal-title"
                className="text-lg font-semibold text-slate-950"
              >
                {editingProduct ? "Edit Product" : "Add New Product"}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 mb-5">
                {editingProduct
                  ? "Update technical specifications and imagery in your catalog."
                  : "Register a new product SKU into the active catalog."}
              </p>

              <form onSubmit={handleSaveProduct} className="space-y-4">
                {/* Row 1: Product Name * | Brand * */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label
                      htmlFor="product-name"
                      className="block text-xs font-medium text-slate-700 mb-1"
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
                      className="w-full rounded-xl bg-slate-50/70 border border-slate-200 px-3.5 py-2 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 focus:bg-white transition"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="product-brand"
                      className="block text-xs font-medium text-slate-700 mb-1"
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
                      className="w-full rounded-xl bg-slate-50/70 border border-slate-200 px-3.5 py-2 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 focus:bg-white transition"
                    />
                  </div>
                </div>

                {/* Row 2: Description * */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="product-description"
                      className="block text-xs font-medium text-slate-700"
                    >
                      Description * (minimum 10 characters)
                    </label>
                    <span className="text-[11px] font-mono text-slate-400">
                      {formData.description.length} chars
                    </span>
                  </div>
                  <textarea
                    id="product-description"
                    rows={3}
                    required
                    minLength={10}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full rounded-xl bg-slate-50/70 border border-slate-200 px-3.5 py-2 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 focus:bg-white transition"
                  />
                </div>

                {/* Row 3: Image URL * OR Upload Image File */}
                <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <label
                      htmlFor="product-image-url"
                      className="block text-xs font-medium text-slate-800"
                    >
                      Product Image * (URL or Local Upload)
                    </label>
                    <label className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-medium cursor-pointer transition shadow-2xs">
                      <Upload className="w-3.5 h-3.5 text-slate-600" />
                      <span>
                        {isUploadingImage
                          ? "Uploading..."
                          : "Upload File from Computer"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileUpload}
                        disabled={isUploadingImage}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="flex gap-3 items-center">
                    <input
                      id="product-image-url"
                      type="text"
                      required
                      value={formData.image_url}
                      onChange={(e) =>
                        setFormData({ ...formData, image_url: e.target.value })
                      }
                      placeholder="https://... or upload an image file above"
                      className="flex-1 rounded-xl bg-white border border-slate-200 px-3.5 py-2 text-xs sm:text-sm text-slate-950 focus:outline-none focus:border-blue-600 transition"
                    />
                    {formData.image_url ? (
                      <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center relative shadow-2xs">
                        <Package className="w-4 h-4 text-slate-400" />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={formData.image_url}
                          alt="Preview"
                          className="w-full h-full object-cover absolute inset-0"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Row 4: Category * | Type * | Sub Type * */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label
                      htmlFor="product-category"
                      className="block text-xs font-medium text-slate-700 mb-1"
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
                      className="w-full rounded-xl bg-slate-50/70 border border-slate-200 px-3 py-2 text-sm text-slate-950 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="product-type"
                      className="block text-xs font-medium text-slate-700 mb-1"
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
                      className="w-full rounded-xl bg-slate-50/70 border border-slate-200 px-3 py-2 text-sm text-slate-950 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="product-sub-type"
                      className="block text-xs font-medium text-slate-700 mb-1"
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
                      className="w-full rounded-xl bg-slate-50/70 border border-slate-200 px-3 py-2 text-sm text-slate-950 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                    />
                  </div>
                </div>

                {/* Row 5: Status * */}
                <div>
                  <label
                    htmlFor="product-status"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Lifecycle Status *
                  </label>
                  <select
                    id="product-status"
                    value={formData.status || "active"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as
                          | "active"
                          | "inactive"
                          | "archived",
                      })
                    }
                    className="w-full rounded-xl bg-slate-50/70 border border-slate-200 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                  >
                    <option value="active">
                      Active — Available for sales &amp; AI recommendations
                    </option>
                    <option value="inactive">
                      Inactive — Temporarily paused from AI suggestions
                    </option>
                    <option value="archived">
                      Archived — Discontinued / historical record only
                    </option>
                  </select>
                </div>

                {/* Modal Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-full border border-slate-200 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    data-testid="submit-product-modal"
                    disabled={formSubmitting}
                    className="px-5 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-medium transition disabled:opacity-50 shadow-2xs"
                  >
                    {formSubmitting
                      ? "Saving..."
                      : editingProduct
                      ? "Save Changes"
                      : "Create Product"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================ */}
      {/* MODAL: TEAM ACCOUNTS MANAGEMENT                              */}
      {/* ============================================================ */}
      <AnimatePresence>
        {isUsersModalOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="users-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsUsersModalOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 p-6 sm:p-7 relative z-10 max-h-[85vh] flex flex-col"
            >
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setIsUsersModalOpen(false)}
                className="absolute right-5 top-5 text-slate-400 hover:text-slate-800 p-1.5 rounded-full hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>

              <h2
                id="users-modal-title"
                className="text-lg font-semibold text-slate-950 flex items-center gap-2"
              >
                <Users className="w-4 h-4 text-slate-700" />
                <span>Team Accounts &amp; Access Governance</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 mb-5 leading-relaxed">
                Manage Business Unit user access states. Inactive or Archived accounts cannot authenticate, while preserving audit history and product ownership.
              </p>

              <div className="overflow-y-auto space-y-2.5 flex-1 pr-1">
                {usersList.map((u) => (
                  <div
                    key={u.id}
                    className="rounded-xl border border-slate-200 p-3.5 flex items-center justify-between gap-4 bg-slate-50/50 hover:bg-white transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-sm font-semibold text-slate-950">
                          {u.username}
                        </strong>
                        {u.id === user?.id && (
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-slate-900 text-white font-medium">
                            Current Session
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 font-mono">
                        {u.email}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        aria-label={`Change status of ${u.username}`}
                        value={u.status || "active"}
                        onChange={(e) =>
                          handleUpdateUserStatus(
                            u.id,
                            e.target.value as "active" | "inactive" | "archived"
                          )
                        }
                        className={`text-xs font-mono font-medium px-3 py-1.5 rounded-full border cursor-pointer focus:outline-none transition ${
                          (u.status || "active") === "active"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : (u.status || "active") === "inactive"
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        <option value="active">ACTIVE (LOGIN ENABLED)</option>
                        <option value="inactive">INACTIVE (SUSPENDED)</option>
                        <option value="archived">ARCHIVED (REVOKED)</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-mono text-slate-500 mt-4">
                <span>TOTAL ACCOUNTS: {usersList.length}</span>
                <button
                  type="button"
                  onClick={() => setIsUsersModalOpen(false)}
                  className="px-5 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-sans font-medium text-xs transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Permanent Delete Confirmation Dialog */}
      <AnimatePresence>
        {permanentDeleteTarget.isOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            data-testid="permanent-delete-modal"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPermanentDeleteTarget({ isOpen: false })}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-red-100 relative z-10"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-950">
                    {permanentDeleteTarget.isEmptyTrash
                      ? "Empty Trash Completely?"
                      : "Permanently Delete Product?"}
                  </h3>
                  <p className="text-xs text-red-600 font-medium">
                    Irreversible database operation
                  </p>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-5">
                {permanentDeleteTarget.isEmptyTrash ? (
                  <>
                    Are you sure you want to permanently purge all{" "}
                    <strong className="text-slate-950 font-semibold">
                      {trashProducts.length} items
                    </strong>{" "}
                    from trash? This cannot be undone.
                  </>
                ) : (
                  <>
                    Are you sure you want to permanently delete{" "}
                    <strong className="text-slate-950 font-semibold">
                      &ldquo;{permanentDeleteTarget.product?.name}&rdquo;
                    </strong>
                    ? It will be permanently removed from the catalog database.
                  </>
                )}
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPermanentDeleteTarget({ isOpen: false })}
                  className="px-4 py-2 rounded-full border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-testid="confirm-permanent-delete-btn"
                  onClick={() => {
                    if (permanentDeleteTarget.isEmptyTrash) {
                      handleEmptyTrash();
                    } else if (permanentDeleteTarget.product) {
                      handlePermanentDelete(permanentDeleteTarget.product);
                    }
                  }}
                  className="px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white font-medium text-xs transition inline-flex items-center gap-1.5 shadow-2xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>
                    {permanentDeleteTarget.isEmptyTrash
                      ? "Yes, Empty Trash"
                      : "Yes, Delete Permanently"}
                  </span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
