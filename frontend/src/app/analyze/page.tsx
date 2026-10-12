"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Layers,
  FileText,
  GitBranchPlus,
  Package,
  Search,
  AlertCircle,
  X,
  TrendingUp,
} from "lucide-react";
import {
  apiFetch,
  clearAuthSession,
  getAuthToken,
  getStoredUser,
  getCapsuleStyle,
  AnalyticsData,
  Product,
  TaxonomyCategory,
  UserProfile,
} from "@/lib/api";
import { TubelightNavbar } from "@/components/ui/tubelight-navbar";

const CHART_COLORS = [
  "#18181b", // zinc-900
  "#2563eb", // blue-600
  "#7c3aed", // violet-600
  "#059669", // emerald-600
  "#d97706", // amber-600
  "#e11d48", // rose-600
];

export default function AnalyzePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [taxonomy, setTaxonomy] = useState<TaxonomyCategory[]>([]);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    try {
      const [stats, prods, tax] = await Promise.all([
        apiFetch<AnalyticsData>("/api/analytics"),
        apiFetch<Product[]>("/api/products"),
        apiFetch<TaxonomyCategory[]>("/api/taxonomy"),
      ]);
      setAnalytics(stats);
      setProducts(prods);
      setTaxonomy(tax);
    } catch (err: unknown) {
      setErrorBanner(
        err instanceof Error ? err.message : "Failed to load analytics data"
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
    loadAnalytics();
  }, [router, loadAnalytics]);

  const handleLogout = () => {
    clearAuthSession();
    router.push("/login");
  };

  const categoriesBreakdown = analytics?.categories_breakdown || [];
  const brandsBreakdown = analytics?.brands_breakdown || [];
  const coverageList = analytics?.category_coverage || [];
  const searchModes = analytics?.search_modes_breakdown || [
    { mode: "Quick Search", count: 1 },
    { mode: "Detailed AI Search", count: 1 },
  ];

  const totalProducts = analytics?.total_products ?? products.length;
  const maxCategoryCount = Math.max(
    1,
    ...categoriesBreakdown.map((c) => c.count)
  );
  const maxCoverageValue = Math.max(
    1,
    ...coverageList.flatMap((c) => [c.skus, c.docs, c.cross_sells])
  );

  // Compute SVG Donut segments for Brand Distribution
  const totalBrandItems = Math.max(
    1,
    brandsBreakdown.reduce((acc, b) => acc + b.count, 0)
  );
  let cumulativePercent = 0;
  const donutSegments = brandsBreakdown.map((item, idx) => {
    const pct = (item.count / totalBrandItems) * 100;
    const startOffset = 100 - cumulativePercent;
    cumulativePercent += pct;
    return {
      ...item,
      pct,
      color: CHART_COLORS[idx % CHART_COLORS.length],
      strokeDasharray: `${pct} ${100 - pct}`,
      strokeDashoffset: startOffset,
    };
  });

  const totalSearchCount = Math.max(
    1,
    searchModes.reduce((acc, m) => acc + m.count, 0)
  );

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 pb-20">
      <TubelightNavbar
        activeTab="analytics"
        activeProductsCount={products.length}
        user={user}
        onLogout={handleLogout}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 space-y-6">
        {/* Workspace Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50/90 text-emerald-700 border border-emerald-200/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              <span>Analytics Dashboard</span>
            </span>
            <span className="text-xs sm:text-sm text-zinc-500">
              ภาพรวมข้อมูลสินค้า โครงสร้างหมวดหมู่ (Category &rarr; Type &rarr; Sub-Type) และสถิติการค้นหา
            </span>
          </div>
        </div>

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

        {/* 1. Executive KPI Summary Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-zinc-200/90 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500">
                Active Catalog SKUs
              </span>
              <span className="p-1.5 rounded-lg bg-zinc-100 text-zinc-700">
                <Package className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-semibold text-zinc-950 mt-2 tabular-nums">
              {totalProducts}
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              Across {taxonomy.length} primary categories
            </div>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200/90 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500">
                Total Search Queries
              </span>
              <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                <Search className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-semibold text-zinc-950 mt-2 tabular-nums">
              {analytics?.total_searches ?? 0}
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              Quick + Detailed AI queries
            </div>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200/90 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500">
                Supporting Documents
              </span>
              <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                <FileText className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-semibold text-zinc-950 mt-2 tabular-nums">
              {analytics?.total_supporting_documents ?? 0}
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              Validation reports &amp; briefs
            </div>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200/90 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500">
                Cross-Sell Pairings
              </span>
              <span className="p-1.5 rounded-lg bg-violet-50 text-violet-600">
                <GitBranchPlus className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-semibold text-zinc-950 mt-2 tabular-nums">
              {analytics?.total_cross_sell_links ?? 0}
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              Mapped workflow companions
            </div>
          </div>
        </div>

        {/* 2. Primary Visual Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart A: Multi-Metric Vertical Bar Graph per Category */}
          <div className="bg-white rounded-2xl border border-zinc-200/90 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-zinc-950 tracking-tight">
                    Category Coverage &amp; Documentation Depth
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    จำนวนสินค้า เอกสารประกอบ และสินค้าพ่วงขายแยกตามหมวดหมู่หลัก
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-600">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-xs bg-zinc-900" />
                    SKUs
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-xs bg-blue-600" />
                    Docs
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-xs bg-emerald-500" />
                    Cross-Sell
                  </span>
                </div>
              </div>

              {/* Vertical Grouped Bar Chart */}
              <div className="h-56 flex items-end justify-around gap-4 pt-6 pb-2 px-3 border-b border-zinc-200/80 bg-zinc-50/40 rounded-t-xl">
                {coverageList.map((item) => {
                  const skuH = Math.max(
                    10,
                    Math.round((item.skus / maxCoverageValue) * 160)
                  );
                  const docH = Math.max(
                    10,
                    Math.round((item.docs / maxCoverageValue) * 160)
                  );
                  const csH = Math.max(
                    10,
                    Math.round((item.cross_sells / maxCoverageValue) * 160)
                  );
                  return (
                    <div
                      key={item.category}
                      className="flex flex-col items-center flex-1 min-w-0 group"
                    >
                      <div className="flex items-end justify-center gap-1.5 sm:gap-2 w-full h-44">
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] font-mono text-zinc-700 font-semibold mb-1 tabular-nums">
                            {item.skus}
                          </span>
                          <div
                            style={{ height: `${skuH}px` }}
                            className="w-4 sm:w-5 rounded-t-sm bg-zinc-900 transition-all"
                            title={`SKUs: ${item.skus}`}
                          />
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] font-mono text-blue-600 font-semibold mb-1 tabular-nums">
                            {item.docs}
                          </span>
                          <div
                            style={{ height: `${docH}px` }}
                            className="w-4 sm:w-5 rounded-t-sm bg-blue-600 transition-all"
                            title={`Supporting Docs: ${item.docs}`}
                          />
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] font-mono text-emerald-600 font-semibold mb-1 tabular-nums">
                            {item.cross_sells}
                          </span>
                          <div
                            style={{ height: `${csH}px` }}
                            className="w-4 sm:w-5 rounded-t-sm bg-emerald-500 transition-all"
                            title={`Cross-sells: ${item.cross_sells}`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* X-Axis Labels */}
              <div className="flex justify-around gap-2 pt-3">
                {coverageList.map((item) => (
                  <div
                    key={item.category}
                    className="flex-1 text-center min-w-0"
                  >
                    <span
                      className={`inline-block max-w-full truncate text-[10px] font-medium px-2 py-0.5 rounded-md border ${getCapsuleStyle(
                        item.category,
                        "category"
                      )}`}
                    >
                      {item.category}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Chart B: SVG Donut Chart — Brand Share & Search Mode Breakdown */}
          <div className="bg-white rounded-2xl border border-zinc-200/90 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col justify-between">
            <div>
              <div className="mb-5">
                <h3 className="text-sm sm:text-base font-semibold text-zinc-950 tracking-tight">
                  Brand Portfolio Distribution
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  สัดส่วนสินค้าแยกตามแบรนด์ผู้ผลิตในแคตตาล็อก
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* SVG Donut Chart */}
                <div className="relative w-40 h-40 shrink-0 flex items-center justify-center">
                  <svg
                    viewBox="0 0 42 42"
                    className="w-full h-full -rotate-90"
                  >
                    <circle
                      cx="21"
                      cy="21"
                      r="15.91549430918954"
                      fill="transparent"
                      stroke="#f4f4f5"
                      strokeWidth="5"
                    />
                    {donutSegments.map((seg) => (
                      <circle
                        key={seg.brand}
                        cx="21"
                        cy="21"
                        r="15.91549430918954"
                        fill="transparent"
                        stroke={seg.color}
                        strokeWidth="5"
                        strokeDasharray={seg.strokeDasharray}
                        strokeDashoffset={seg.strokeDashoffset}
                      />
                    ))}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-mono font-semibold text-zinc-950 tabular-nums">
                      {totalProducts}
                    </span>
                    <span className="text-[10px] font-mono uppercase text-zinc-400">
                      SKUs
                    </span>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex-1 w-full space-y-2">
                  {donutSegments.map((seg) => (
                    <div
                      key={seg.brand}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-50/80 border border-zinc-200/70 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: seg.color }}
                        />
                        <span className="font-medium text-zinc-900">
                          {seg.brand}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono tabular-nums">
                        <span className="text-zinc-400">
                          {Math.round(seg.pct)}%
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-white border border-zinc-200/80 text-zinc-800 font-semibold text-[11px]">
                          {seg.count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Search Mode Activity Mini-Graph */}
            <div className="mt-6 pt-4 border-t border-zinc-100">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-700 mb-2.5">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Search Mode Telemetry</span>
                </span>
                <span className="font-mono text-zinc-400 tabular-nums">
                  {analytics?.total_searches ?? 0} total queries
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {searchModes.map((m, idx) => {
                  const pct = Math.round((m.count / totalSearchCount) * 100);
                  return (
                    <div
                      key={m.mode}
                      className="p-3 rounded-xl bg-zinc-50/70 border border-zinc-200/70"
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-medium text-zinc-700">
                          {m.mode}
                        </span>
                        <span className="font-mono font-semibold text-zinc-900 tabular-nums">
                          {m.count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-200/80 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            idx === 0 ? "bg-zinc-900" : "bg-blue-600"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Relational Taxonomy Hierarchy Matrix (Category -> Type -> Sub-Type) */}
        <div className="bg-white rounded-2xl border border-zinc-200/90 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-zinc-950 tracking-tight flex items-center gap-2">
                <Layers className="w-4 h-4 text-zinc-500" />
                <span>Relational Taxonomy Matrix (Category &rarr; Type &rarr; Sub-Type)</span>
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                โครงสร้างความสัมพันธ์ของหมวดหมู่หลัก ประเภทสินค้า และประเภทย่อยในฐานข้อมูล
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {taxonomy.map((cat, idx) => {
              const catCount =
                categoriesBreakdown.find((c) => c.category === cat.name)
                  ?.count || 0;
              const barPct = Math.round((catCount / maxCategoryCount) * 100);
              const barColor = CHART_COLORS[idx % CHART_COLORS.length];

              return (
                <div
                  key={cat.id}
                  className="p-4 rounded-xl bg-zinc-50/60 border border-zinc-200/80 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs font-medium px-2.5 py-0.5 rounded-md border ${getCapsuleStyle(
                        cat.name,
                        "category"
                      )}`}
                    >
                      {cat.name}
                    </span>
                    <span className="text-xs font-mono font-semibold text-zinc-700 tabular-nums">
                      {catCount} SKU(s)
                    </span>
                  </div>

                  {/* Category Progress Bar */}
                  <div className="w-full h-1.5 bg-zinc-200/80 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(8, barPct)}%`,
                        backgroundColor: barColor,
                      }}
                    />
                  </div>

                  {/* Related Types & Sub-Types */}
                  <div className="space-y-2 pt-1">
                    {cat.types.map((t) => (
                      <div
                        key={t.id}
                        className="pl-3 border-l-2 border-zinc-200 space-y-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${getCapsuleStyle(
                              t.name,
                              "type"
                            )}`}
                          >
                            {t.name}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 pl-1">
                          {t.sub_types.map((st) => (
                            <span
                              key={st.id}
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${getCapsuleStyle(
                                st.name,
                                "sub_type"
                              )}`}
                            >
                              {st.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
