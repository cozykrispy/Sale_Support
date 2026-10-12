"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  Package,
  Plus,
  SquarePen,
  Trash2,
  RotateCcw,
  Archive,
  X,
  CheckCircle2,
  AlertCircle,
  LayoutGrid,
  List,
  Table,
  ChevronLeft,
  ChevronRight,
  Upload,
} from "lucide-react";
import {
  apiFetch,
  clearAuthSession,
  getAuthToken,
  getStoredUser,
  uploadProductImage,
  getCapsuleStyle,
  Product,
  ProductCreatePayload,
  TaxonomyCategory,
  TaxonomyType,
  TaxonomySubType,
  UserProfile,
} from "@/lib/api";
import { TubelightNavbar } from "@/components/ui/tubelight-navbar";
import { TaxonomyCombobox } from "@/components/ui/taxonomy-combobox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProductDetailModal } from "@/components/ui/product-detail-modal";

const PAGE_SIZE = 10;

const EMPTY_FORM: ProductCreatePayload = {
  name: "",
  brand: "",
  description: "",
  image_url: "",
  category: "",
  type: "",
  sub_type: "",
};

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export default function ProductManagePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);

  // Catalog & Taxonomy State
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [taxonomy, setTaxonomy] = useState<TaxonomyCategory[]>([]);
  const [catalogView, setCatalogView] = useState<"active" | "trash">("active");
  // Board view removed per requirement
  const [catalogDisplayMode, setCatalogDisplayMode] = useState<
    "grid" | "list" | "table"
  >("grid");

  // Search & Shadcn Taxonomy Filter State
  const [catalogSearch, setCatalogSearch] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Add / Edit Product Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductCreatePayload>(EMPTY_FORM);
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);

  // Product Detail Modal State
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);

  // Confirmation Dialog State
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    description: React.ReactNode;
    confirmLabel: string;
    variant: "danger" | "primary" | "warning" | "success";
    onConfirm: () => Promise<void> | void;
  }>({
    isOpen: false,
    title: "",
    description: "",
    confirmLabel: "Confirm",
    variant: "primary",
    onConfirm: () => {},
  });

  // Feedback banners
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = useCallback(async () => {
    try {
      const [prods, tax] = await Promise.all([
        apiFetch<Product[]>("/api/products?include_deleted=true"),
        apiFetch<TaxonomyCategory[]>("/api/taxonomy"),
      ]);
      setAllProducts(prods);
      setTaxonomy(tax);
    } catch (err: unknown) {
      setErrorBanner(
        err instanceof Error ? err.message : "Failed to load product catalog"
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
    loadData();
  }, [router, loadData]);

  const handleLogout = () => {
    clearAuthSession();
    router.push("/login");
  };

  // Filtered & Paginated Products (10 items per page, 3 columns in grid)
  const activeProducts = allProducts.filter((p) => !p.is_deleted);
  const trashProducts = allProducts.filter((p) => p.is_deleted);
  const currentCatalogList =
    catalogView === "active" ? activeProducts : trashProducts;

  const filteredProducts = currentCatalogList.filter((p) => {
    const matchesCategory =
      !selectedCategory || p.category === selectedCategory;
    const matchesType = !selectedType || p.type === selectedType;
    const q = catalogSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.type.toLowerCase().includes(q) ||
      p.sub_type.toLowerCase().includes(q);
    return matchesCategory && matchesType && matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Derived Hierarchical Options for Filter Bar
  const filterCategoryOptions = [
    { value: "", label: "All Categories" },
    ...taxonomy.map((c) => ({ id: c.id, value: c.name, label: c.name })),
  ];
  const filterCatNode = taxonomy.find((c) => c.name === selectedCategory);
  const filterTypeOptions = [
    { value: "", label: "All Types" },
    ...(filterCatNode
      ? filterCatNode.types
      : taxonomy.flatMap((c) => c.types)
    ).map((t) => ({ id: t.id, value: t.name, label: t.name })),
  ];

  // Derived Hierarchical Options for Add/Edit Form (Category -> Type -> SubType)
  const formCatNode = taxonomy.find((c) => c.name === formData.category);
  const formCategoryOptions = taxonomy.map((c) => ({
    id: c.id,
    value: c.name,
    label: c.name,
  }));

  const formTypeList = formCatNode ? formCatNode.types : [];
  const formTypeOptions = formTypeList.map((t) => ({
    id: t.id,
    value: t.name,
    label: t.name,
  }));

  const formTypeNode = formTypeList.find((t) => t.name === formData.type);
  const formSubTypeList = formTypeNode ? formTypeNode.sub_types : [];
  const formSubTypeOptions = formSubTypeList.map((st) => ({
    id: st.id,
    value: st.name,
    label: st.name,
  }));

  // Handlers for creating new Category / Type / SubType with Confirmation
  const handlePromptCreateCategory = (newCatName: string) => {
    setConfirmState({
      isOpen: true,
      title: "Create new category",
      description: (
        <>
          Add primary category{" "}
          <strong className="text-zinc-950 font-semibold">
            &ldquo;{newCatName}&rdquo;
          </strong>{" "}
          to the catalog taxonomy?
        </>
      ),
      confirmLabel: "Create Category",
      variant: "primary",
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
        try {
          const created = await apiFetch<TaxonomyCategory>(
            "/api/taxonomy/categories",
            {
              method: "POST",
              body: JSON.stringify({ name: newCatName }),
            }
          );
          await loadData();
          setFormData((prev) => ({
            ...prev,
            category: created.name,
            category_id: created.id,
            type: "",
            type_id: undefined,
            sub_type: "",
            sub_type_id: undefined,
          }));
          showToast(`Added category "${created.name}".`);
        } catch (err: unknown) {
          setErrorBanner(
            err instanceof Error ? err.message : "Failed to create category"
          );
        }
      },
    });
  };

  const handlePromptCreateType = (newTypeName: string) => {
    if (!formCatNode) {
      setErrorBanner("Please select a Category before creating a Type.");
      return;
    }
    setConfirmState({
      isOpen: true,
      title: "Create new product type",
      description: (
        <>
          Add product type{" "}
          <strong className="text-zinc-950 font-semibold">
            &ldquo;{newTypeName}&rdquo;
          </strong>{" "}
          under{" "}
          <strong className="text-zinc-950 font-semibold">
            {formCatNode.name}
          </strong>
          ?
        </>
      ),
      confirmLabel: "Create Type",
      variant: "primary",
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
        try {
          const created = await apiFetch<TaxonomyType>("/api/taxonomy/types", {
            method: "POST",
            body: JSON.stringify({
              name: newTypeName,
              category_id: formCatNode.id,
            }),
          });
          await loadData();
          setFormData((prev) => ({
            ...prev,
            type: created.name,
            type_id: created.id,
            sub_type: "",
            sub_type_id: undefined,
          }));
          showToast(`Added type "${created.name}" under ${formCatNode.name}.`);
        } catch (err: unknown) {
          setErrorBanner(
            err instanceof Error ? err.message : "Failed to create product type"
          );
        }
      },
    });
  };

  const handlePromptCreateSubType = (newSubTypeName: string) => {
    if (!formTypeNode) {
      setErrorBanner("Please select a Type before creating a Sub-Type.");
      return;
    }
    setConfirmState({
      isOpen: true,
      title: "Create new sub-type",
      description: (
        <>
          Add sub-type{" "}
          <strong className="text-zinc-950 font-semibold">
            &ldquo;{newSubTypeName}&rdquo;
          </strong>{" "}
          under{" "}
          <strong className="text-zinc-950 font-semibold">
            {formTypeNode.name}
          </strong>
          ?
        </>
      ),
      confirmLabel: "Create Sub-Type",
      variant: "primary",
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
        try {
          const created = await apiFetch<TaxonomySubType>(
            "/api/taxonomy/sub-types",
            {
              method: "POST",
              body: JSON.stringify({
                name: newSubTypeName,
                type_id: formTypeNode.id,
              }),
            }
          );
          await loadData();
          setFormData((prev) => ({
            ...prev,
            sub_type: created.name,
            sub_type_id: created.id,
          }));
          showToast(
            `Added sub-type "${created.name}" under ${formTypeNode.name}.`
          );
        } catch (err: unknown) {
          setErrorBanner(
            err instanceof Error ? err.message : "Failed to create sub-type"
          );
        }
      },
    });
  };

  const openAddModal = () => {
    setEditingProduct(null);
    const defaultCat = taxonomy[0];
    const defaultType = defaultCat?.types[0];
    const defaultSub = defaultType?.sub_types[0];
    setFormData({
      ...EMPTY_FORM,
      category: defaultCat?.name || "Chromatography Solutions",
      category_id: defaultCat?.id,
      type: defaultType?.name || "Chromatography Columns",
      type_id: defaultType?.id,
      sub_type: defaultSub?.name || "Process Columns",
      sub_type_id: defaultSub?.id,
    });
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
      category_id: product.category_id,
      type_id: product.type_id,
      sub_type_id: product.sub_type_id,
    });
    setErrorBanner(null);
    setIsModalOpen(true);
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
      showToast(`Uploaded image "${file.name}".`);
    } catch (err: unknown) {
      setErrorBanner(
        err instanceof Error ? err.message : "Failed to upload image file"
      );
    } finally {
      setIsUploadingImage(false);
      e.target.value = "";
    }
  };

  // Validate form and open Confirmation Dialog before saving
  const handleFormSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const descTrimmed = formData.description.trim();
    const words = countWords(descTrimmed);

    if (descTrimmed.length < 10) {
      setErrorBanner("Description must be at least 10 characters.");
      return;
    }
    if (words > 1000) {
      setErrorBanner(
        `Description must not exceed 1,000 words (currently ${words} words).`
      );
      return;
    }
    if (
      !formData.category.trim() ||
      !formData.type.trim() ||
      !formData.sub_type.trim()
    ) {
      setErrorBanner("Please select Category, Type, and Sub-Type.");
      return;
    }

    setErrorBanner(null);

    setConfirmState({
      isOpen: true,
      title: editingProduct ? "Save product changes" : "Create new product",
      description: editingProduct ? (
        <>
          Save updates to{" "}
          <strong className="text-zinc-950 font-semibold">
            &ldquo;{formData.name}&rdquo;
          </strong>
          ?
        </>
      ) : (
        <>
          Add{" "}
          <strong className="text-zinc-950 font-semibold">
            &ldquo;{formData.name}&rdquo;
          </strong>{" "}
          ({formData.category} &rarr; {formData.type} &rarr;{" "}
          {formData.sub_type}) to the active catalog?
        </>
      ),
      confirmLabel: editingProduct ? "Save Changes" : "Create Product",
      variant: "success",
      onConfirm: executeSaveProduct,
    });
  };

  const executeSaveProduct = async () => {
    setConfirmState((prev) => ({ ...prev, isOpen: false }));
    setFormSubmitting(true);
    try {
      if (editingProduct) {
        await apiFetch<Product>(`/api/products/${editingProduct.id}`, {
          method: "PUT",
          body: JSON.stringify(formData),
        });
        showToast(`Updated "${formData.name}".`);
      } else {
        await apiFetch<Product>("/api/products", {
          method: "POST",
          body: JSON.stringify(formData),
        });
        showToast(`Created "${formData.name}".`);
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      setErrorBanner(
        err instanceof Error ? err.message : "Failed to save product"
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  const promptSoftDeleteProduct = (product: Product) => {
    setConfirmState({
      isOpen: true,
      title: "Move product to trash",
      description: (
        <>
          Move{" "}
          <strong className="text-zinc-950 font-semibold">
            &ldquo;{product.name}&rdquo;
          </strong>{" "}
          to Trash? You can restore it later if needed.
        </>
      ),
      confirmLabel: "Move to Trash",
      variant: "danger",
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
        try {
          await apiFetch(`/api/products/${product.id}`, { method: "DELETE" });
          setSelectedIds((prev) => prev.filter((id) => id !== product.id));
          showToast(`Moved "${product.name}" to Trash.`);
          await loadData();
        } catch (err: unknown) {
          setErrorBanner(
            err instanceof Error ? err.message : "Failed to delete product"
          );
        }
      },
    });
  };

  const promptBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setConfirmState({
      isOpen: true,
      title: "Remove selected products",
      description: (
        <>
          Move{" "}
          <strong className="text-zinc-950 font-semibold">
            {selectedIds.length} selected product(s)
          </strong>{" "}
          to Trash?
        </>
      ),
      confirmLabel: `Remove (${selectedIds.length})`,
      variant: "danger",
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
        try {
          await Promise.all(
            selectedIds.map((id) =>
              apiFetch(`/api/products/${id}`, { method: "DELETE" })
            )
          );
          showToast(`Moved ${selectedIds.length} product(s) to Trash.`);
          setSelectedIds([]);
          await loadData();
        } catch (err: unknown) {
          setErrorBanner(
            err instanceof Error ? err.message : "Failed to bulk delete products"
          );
        }
      },
    });
  };

  const promptRestoreProduct = (product: Product) => {
    setConfirmState({
      isOpen: true,
      title: "Restore product",
      description: (
        <>
          Restore{" "}
          <strong className="text-zinc-950 font-semibold">
            &ldquo;{product.name}&rdquo;
          </strong>{" "}
          back to the active catalog?
        </>
      ),
      confirmLabel: "Restore",
      variant: "success",
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
        try {
          await apiFetch<Product>(`/api/products/${product.id}/restore`, {
            method: "POST",
          });
          showToast(`Restored "${product.name}".`);
          await loadData();
        } catch (err: unknown) {
          setErrorBanner(
            err instanceof Error ? err.message : "Failed to restore product"
          );
        }
      },
    });
  };

  const promptPermanentDelete = (product: Product) => {
    setConfirmState({
      isOpen: true,
      title: "Delete product permanently",
      description: (
        <>
          Permanently delete{" "}
          <strong className="text-zinc-950 font-semibold">
            &ldquo;{product.name}&rdquo;
          </strong>
          ? This action cannot be undone.
        </>
      ),
      confirmLabel: "Delete Permanently",
      variant: "danger",
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
        try {
          await apiFetch(`/api/products/${product.id}/permanent`, {
            method: "DELETE",
          });
          showToast(`Permanently deleted "${product.name}".`);
          await loadData();
        } catch (err: unknown) {
          setErrorBanner(
            err instanceof Error
              ? err.message
              : "Failed to permanently delete product"
          );
        }
      },
    });
  };

  const promptEmptyTrash = () => {
    setConfirmState({
      isOpen: true,
      title: "Empty trash permanently",
      description: (
        <>
          Permanently delete all{" "}
          <strong className="text-zinc-950 font-semibold">
            {trashProducts.length} item(s)
          </strong>{" "}
          in Trash? This action cannot be undone.
        </>
      ),
      confirmLabel: "Empty Trash",
      variant: "danger",
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
        try {
          await apiFetch(`/api/products/trash/empty`, { method: "DELETE" });
          showToast("Emptied trash.");
          await loadData();
        } catch (err: unknown) {
          setErrorBanner(
            err instanceof Error ? err.message : "Failed to empty trash"
          );
        }
      },
    });
  };

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(paginatedProducts.map((p) => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const descriptionWordCount = countWords(formData.description);

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 pb-20">
      <TubelightNavbar
        activeTab="manage"
        activeProductsCount={activeProducts.length}
        user={user}
        onLogout={handleLogout}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 space-y-5">
        {/* Workspace Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-violet-50/90 text-violet-700 border border-violet-200/80">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-600" />
              <span>Product Manage</span>
            </span>
            <span className="text-xs sm:text-sm text-zinc-500">
              จัดการข้อมูลสินค้าและโครงสร้างหมวดหมู่ (Category &rarr; Type &rarr; Sub-Type)
            </span>
          </div>
        </div>

        {/* Notifications */}
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

        {toastMessage && (
          <div
            role="status"
            className="flex items-center gap-2.5 rounded-xl bg-zinc-900 text-white px-4 py-2.5 text-xs sm:text-sm font-medium shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Main Management Surface */}
        <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] p-6 sm:p-7">
          {/* Top Header & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-5 border-b border-zinc-100">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-zinc-950 tracking-tight">
                Product Portfolio Management
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
                Create, update, and classify catalog SKUs across relational taxonomy tiers.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {catalogView === "trash" && trashProducts.length > 0 && (
                <button
                  type="button"
                  onClick={promptEmptyTrash}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-2 text-xs font-medium transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Empty Trash ({trashProducts.length})</span>
                </button>
              )}
              {selectedIds.length > 0 && catalogView === "active" && (
                <button
                  type="button"
                  onClick={promptBulkDelete}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 text-xs font-medium transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Selected ({selectedIds.length})</span>
                </button>
              )}
              <button
                type="button"
                data-testid="add-product-button"
                onClick={openAddModal}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white px-3.5 py-2 text-xs sm:text-sm font-medium transition shadow-2xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add Product</span>
              </button>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 mb-5">
            <div className="flex flex-wrap items-center gap-3">
              <h3
                data-testid="catalog-count-heading"
                className="text-xs sm:text-sm font-semibold text-zinc-900 font-mono tabular-nums"
              >
                Product Catalog ({filteredProducts.length} of{" "}
                {catalogView === "active"
                  ? activeProducts.length
                  : trashProducts.length}{" "}
                products)
              </h3>

              {/* Active vs Trash View Toggle */}
              <div className="inline-flex rounded-lg bg-zinc-100/80 p-1 border border-zinc-200/70 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setCatalogView("active");
                    setSelectedIds([]);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-md font-medium transition tabular-nums ${
                    catalogView === "active"
                      ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  Active ({activeProducts.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCatalogView("trash");
                    setSelectedIds([]);
                    setCurrentPage(1);
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition tabular-nums ${
                    catalogView === "trash"
                      ? "bg-white text-rose-600 shadow-2xs font-semibold"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Trash ({trashProducts.length})</span>
                </button>
              </div>
            </div>

            {/* Search Input + Shadcn Category/Type Comboboxes */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:w-60 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => {
                    setCatalogSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Filter by name, brand, spec..."
                  className="w-full rounded-lg bg-zinc-50/70 border border-zinc-200/90 pl-8 pr-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 focus:bg-white transition"
                />
              </div>

              <div className="w-44">
                <TaxonomyCombobox
                  placeholder="All Categories"
                  value={selectedCategory}
                  options={filterCategoryOptions}
                  allowCreate={false}
                  onChange={(val) => {
                    setSelectedCategory(val);
                    setSelectedType("");
                    setCurrentPage(1);
                  }}
                />
              </div>

              <div className="w-44">
                <TaxonomyCombobox
                  placeholder="All Types"
                  value={selectedType}
                  options={filterTypeOptions}
                  allowCreate={false}
                  onChange={(val) => {
                    setSelectedType(val);
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>
          </div>

          {/* View Switcher Bar (Gallery 3-Col, List, Table — Board View Removed) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 px-3 py-2 rounded-xl bg-zinc-50/70 border border-zinc-200/70">
            <div className="flex items-center gap-2.5 text-xs font-medium text-zinc-600">
              <input
                id="select-all-products"
                type="checkbox"
                checked={
                  paginatedProducts.length > 0 &&
                  paginatedProducts.every((p) => selectedIds.includes(p.id))
                }
                onChange={(e) => handleToggleSelectAll(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
              />
              <label
                htmlFor="select-all-products"
                className="cursor-pointer select-none"
              >
                Select page ({paginatedProducts.length})
              </label>
              {selectedIds.length > 0 && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-zinc-900 text-white font-semibold tabular-nums">
                  {selectedIds.length} selected
                </span>
              )}
            </div>

            <div className="inline-flex items-center rounded-lg bg-white p-1 border border-zinc-200/80 self-start sm:self-auto">
              {(
                [
                  { id: "grid", label: "Gallery", icon: LayoutGrid },
                  { id: "list", label: "List", icon: List },
                  { id: "table", label: "Table", icon: Table },
                ] as const
              ).map((mode) => {
                const Icon = mode.icon;
                const isActive = catalogDisplayMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setCatalogDisplayMode(mode.id)}
                    className={`relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      isActive
                        ? "text-zinc-950 font-semibold"
                        : "text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="catalog-view-pill"
                        className="absolute inset-0 bg-zinc-100 border border-zinc-200/80 rounded-md"
                        transition={{
                          type: "spring",
                          stiffness: 420,
                          damping: 32,
                        }}
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
          {paginatedProducts.length === 0 && (
            <div className="text-center py-16 text-xs sm:text-sm text-zinc-500 border border-dashed border-zinc-200 rounded-xl bg-zinc-50/40">
              <Package className="w-7 h-7 text-zinc-300 mx-auto mb-2" />
              <p className="font-medium text-zinc-700">
                No matching products found
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Try adjusting your search query or category filter.
              </p>
            </div>
          )}

          {/* VIEW 1: GALLERY GRID (3 Columns per Row, 10 per Page) */}
          {paginatedProducts.length > 0 && catalogDisplayMode === "grid" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
              {paginatedProducts.map((product) => (
                <div
                  key={product.id}
                  data-testid={`product-card-${product.id}`}
                  className="group rounded-xl border border-zinc-200/85 bg-white p-4 flex flex-col justify-between hover:border-zinc-300 hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.06)] transition-all duration-200"
                >
                  <div>
                    {/* Top Row: Checkbox + Brand Capsule */}
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
                        className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                      />

                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-zinc-900 text-white">
                        {product.brand}
                      </span>
                    </div>

                    {/* Photo Thumbnail */}
                    <div
                      onClick={() => setDetailProduct(product)}
                      className="w-full h-36 rounded-lg bg-zinc-50 border border-zinc-100 overflow-hidden flex items-center justify-center relative mb-3 cursor-pointer"
                    >
                      <Package className="w-7 h-7 text-zinc-300" />
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

                    {/* Distinct Color Capsules for Category / Type / Sub Type */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${getCapsuleStyle(
                          product.category,
                          "category"
                        )}`}
                      >
                        {product.category}
                      </span>
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${getCapsuleStyle(
                          product.type,
                          "type"
                        )}`}
                      >
                        {product.type}
                      </span>
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${getCapsuleStyle(
                          product.sub_type,
                          "sub_type"
                        )}`}
                      >
                        {product.sub_type}
                      </span>
                    </div>

                    {/* Product Title */}
                    <h4
                      onClick={() => setDetailProduct(product)}
                      className="font-semibold text-zinc-900 text-sm sm:text-[15px] line-clamp-1 cursor-pointer group-hover:text-violet-600 transition-colors tracking-tight"
                    >
                      {product.name}
                    </h4>

                    {/* Compact Description Preview */}
                    <p className="text-xs text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>
                  </div>

                  {/* Bottom Actions */}
                  <div className="pt-3 mt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setDetailProduct(product)}
                      className="text-xs font-medium text-zinc-500 hover:text-zinc-900 transition"
                    >
                      ดูรายละเอียด
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      {product.is_deleted ? (
                        <>
                          <button
                            type="button"
                            aria-label={`Restore ${product.name}`}
                            data-testid={`restore-product-${product.name}`}
                            onClick={() => promptRestoreProduct(product)}
                            className="p-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                            title="Restore product"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete Permanently ${product.name}`}
                            data-testid={`permanent-delete-product-${product.name}`}
                            onClick={() => promptPermanentDelete(product)}
                            className="p-1.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 transition"
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
                            className="p-1.5 rounded-lg border border-zinc-200/90 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition"
                            title="Edit product"
                          >
                            <SquarePen className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${product.name}`}
                            data-testid={`delete-product-${product.name}`}
                            onClick={() => promptSoftDeleteProduct(product)}
                            className="p-1.5 rounded-lg border border-zinc-200/90 text-zinc-600 hover:text-rose-600 hover:bg-rose-50 transition"
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
          {paginatedProducts.length > 0 && catalogDisplayMode === "list" && (
            <div className="space-y-2">
              {paginatedProducts.map((product) => (
                <div
                  key={product.id}
                  data-testid={`product-card-${product.id}`}
                  className="rounded-xl border border-zinc-200/85 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-zinc-300 transition bg-white"
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
                      className="mt-1 sm:mt-0 w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer shrink-0"
                    />

                    <div
                      onClick={() => setDetailProduct(product)}
                      className="w-12 h-12 rounded-lg bg-zinc-50 border border-zinc-200/70 overflow-hidden flex items-center justify-center shrink-0 text-zinc-400 relative cursor-pointer"
                    >
                      <Package className="w-5 h-5 text-zinc-300" />
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
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h4
                          onClick={() => setDetailProduct(product)}
                          className="font-semibold text-zinc-900 text-sm cursor-pointer hover:text-violet-600"
                        >
                          {product.name}
                        </h4>
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-zinc-900 text-white">
                          {product.brand}
                        </span>
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${getCapsuleStyle(
                            product.category,
                            "category"
                          )}`}
                        >
                          {product.category}
                        </span>
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${getCapsuleStyle(
                            product.type,
                            "type"
                          )}`}
                        >
                          {product.type}
                        </span>
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${getCapsuleStyle(
                            product.sub_type,
                            "sub_type"
                          )}`}
                        >
                          {product.sub_type}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-1 line-clamp-1">
                        {product.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100">
                    {product.is_deleted ? (
                      <>
                        <button
                          type="button"
                          aria-label={`Restore ${product.name}`}
                          data-testid={`restore-product-${product.name}`}
                          onClick={() => promptRestoreProduct(product)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-medium text-xs transition"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restore</span>
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete Permanently ${product.name}`}
                          data-testid={`permanent-delete-product-${product.name}`}
                          onClick={() => promptPermanentDelete(product)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 font-medium text-xs transition"
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
                          className="p-2 rounded-lg border border-zinc-200/90 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition"
                        >
                          <SquarePen className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${product.name}`}
                          data-testid={`delete-product-${product.name}`}
                          onClick={() => promptSoftDeleteProduct(product)}
                          className="p-2 rounded-lg border border-zinc-200/90 text-zinc-600 hover:text-rose-600 hover:bg-rose-50 transition"
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

          {/* VIEW 3: DATA TABLE */}
          {paginatedProducts.length > 0 && catalogDisplayMode === "table" && (
            <div className="rounded-xl border border-zinc-200/85 overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-700">
                  <thead className="bg-zinc-50/80 border-b border-zinc-200/80 text-[11px] font-mono uppercase text-zinc-500">
                    <tr>
                      <th className="p-3.5 w-10 text-center">
                        <span className="sr-only">Select</span>
                      </th>
                      <th className="p-3.5">Product</th>
                      <th className="p-3.5">Taxonomy Hierarchy</th>
                      <th className="p-3.5">Brand</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {paginatedProducts.map((product) => (
                      <tr
                        key={product.id}
                        data-testid={`product-card-${product.id}`}
                        className="hover:bg-zinc-50/70 transition"
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
                            className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                          />
                        </td>
                        <td className="p-3.5">
                          <div
                            onClick={() => setDetailProduct(product)}
                            className="flex items-center gap-3 cursor-pointer"
                          >
                            <div className="w-9 h-9 rounded-lg bg-zinc-50 border border-zinc-200/70 overflow-hidden flex items-center justify-center shrink-0 relative text-zinc-300">
                              <Package className="w-4 h-4" />
                              {product.image_url ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={product.image_url}
                                  alt={product.name}
                                  className="w-full h-full object-cover absolute inset-0"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display =
                                      "none";
                                  }}
                                />
                              ) : null}
                            </div>
                            <div className="min-w-0 max-w-xs sm:max-w-md">
                              <div className="font-semibold text-zinc-900 truncate hover:text-violet-600">
                                {product.name}
                              </div>
                              <div className="text-zinc-500 text-[11px] truncate">
                                {product.description}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="flex flex-wrap items-center gap-1">
                            <span
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${getCapsuleStyle(
                                product.category,
                                "category"
                              )}`}
                            >
                              {product.category}
                            </span>
                            <span
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${getCapsuleStyle(
                                product.type,
                                "type"
                              )}`}
                            >
                              {product.type}
                            </span>
                            <span
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${getCapsuleStyle(
                                product.sub_type,
                                "sub_type"
                              )}`}
                            >
                              {product.sub_type}
                            </span>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-zinc-900 text-white">
                            {product.brand}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {product.is_deleted ? (
                              <>
                                <button
                                  type="button"
                                  aria-label={`Restore ${product.name}`}
                                  data-testid={`restore-product-${product.name}`}
                                  onClick={() => promptRestoreProduct(product)}
                                  className="p-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Delete Permanently ${product.name}`}
                                  data-testid={`permanent-delete-product-${product.name}`}
                                  onClick={() => promptPermanentDelete(product)}
                                  className="p-1.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 transition"
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
                                  className="p-1.5 rounded-lg border border-zinc-200/90 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition"
                                >
                                  <SquarePen className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Delete ${product.name}`}
                                  data-testid={`delete-product-${product.name}`}
                                  onClick={() =>
                                    promptSoftDeleteProduct(product)
                                  }
                                  className="p-1.5 rounded-lg border border-zinc-200/90 text-zinc-600 hover:text-rose-600 hover:bg-rose-50 transition"
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

          {/* Pagination Bar (10 products per page) */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-5 mt-5 border-t border-zinc-100">
            <span className="text-xs font-mono text-zinc-500 tabular-nums">
              Showing {paginatedProducts.length} of {filteredProducts.length}{" "}
              products · Page {currentPage} of {totalPages}
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
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
        </div>
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
              className="fixed inset-0 bg-zinc-950/40 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: "spring", stiffness: 440, damping: 34 }}
              className="w-full max-w-xl rounded-2xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.14)] border border-zinc-200/90 p-6 sm:p-7 relative z-10"
            >
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setIsModalOpen(false)}
                className="absolute right-5 top-5 text-zinc-400 hover:text-zinc-800 p-1.5 rounded-lg hover:bg-zinc-100 transition"
              >
                <X className="w-4 h-4" />
              </button>

              <h2
                id="modal-title"
                className="text-base sm:text-lg font-semibold text-zinc-950 tracking-tight"
              >
                {editingProduct ? "Edit Product" : "Add New Product"}
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5 mb-5">
                {editingProduct
                  ? "Update technical specifications and relational taxonomy."
                  : "Register a new product into the active catalog."}
              </p>

              <form onSubmit={handleFormSubmitRequest} className="space-y-4">
                {/* Row 1: Product Name * | Brand * */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label
                      htmlFor="product-name"
                      className="block text-xs font-medium text-zinc-700 mb-1"
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
                      className="w-full rounded-lg bg-zinc-50/70 border border-zinc-200/90 px-3 py-2 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 focus:bg-white transition"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="product-brand"
                      className="block text-xs font-medium text-zinc-700 mb-1"
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
                      className="w-full rounded-lg bg-zinc-50/70 border border-zinc-200/90 px-3 py-2 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 focus:bg-white transition"
                    />
                  </div>
                </div>

                {/* Row 2: Description * (Locked max-h, max-w, resize-none, max 1000 words) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="product-description"
                      className="block text-xs font-medium text-zinc-700"
                    >
                      Description *
                    </label>
                    <span
                      className={`text-[11px] font-mono tabular-nums ${
                        descriptionWordCount > 1000
                          ? "text-rose-600 font-semibold"
                          : "text-zinc-400"
                      }`}
                    >
                      {descriptionWordCount} / 1,000 words
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
                    className="w-full max-w-full min-h-[84px] max-h-36 overflow-y-auto resize-none rounded-lg bg-zinc-50/70 border border-zinc-200/90 px-3 py-2 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 focus:bg-white transition"
                  />
                </div>

                {/* Row 3: Image URL * + Upload + Presets */}
                <div className="p-3.5 rounded-xl bg-zinc-50/70 border border-zinc-200/80">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <label
                      htmlFor="product-image-url"
                      className="block text-xs font-medium text-zinc-700"
                    >
                      Image URL *
                    </label>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <label className="cursor-pointer inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white font-medium transition">
                        <Upload className="w-3 h-3" />
                        <span>
                          {isUploadingImage ? "Uploading..." : "Upload"}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageFileUpload}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            image_url:
                              "https://images.unsplash.com/photo-1581093458791-9f3c3900df4b?auto=format&fit=crop&w=800&q=80",
                          })
                        }
                        className="px-2 py-0.5 rounded-md bg-white hover:bg-zinc-100 text-zinc-600 border border-zinc-200/80 font-medium transition"
                      >
                        Skid
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            image_url:
                              "https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80",
                          })
                        }
                        className="px-2 py-0.5 rounded-md bg-white hover:bg-zinc-100 text-zinc-600 border border-zinc-200/80 font-medium transition"
                      >
                        Column
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            image_url:
                              "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80",
                          })
                        }
                        className="px-2 py-0.5 rounded-md bg-white hover:bg-zinc-100 text-zinc-600 border border-zinc-200/80 font-medium transition"
                      >
                        Filter
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2.5 items-center">
                    <input
                      id="product-image-url"
                      type="url"
                      required
                      value={formData.image_url}
                      onChange={(e) =>
                        setFormData({ ...formData, image_url: e.target.value })
                      }
                      placeholder="https://images.unsplash.com/..."
                      className="flex-1 rounded-lg bg-white border border-zinc-200/90 px-3 py-2 text-xs sm:text-sm text-zinc-950 focus:outline-none focus:border-zinc-400 transition"
                    />
                    {formData.image_url ? (
                      <div className="w-10 h-10 rounded-lg bg-zinc-100 border border-zinc-200/80 overflow-hidden shrink-0 flex items-center justify-center relative">
                        <Package className="w-4 h-4 text-zinc-400" />
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

                {/* Row 4: Hierarchical Comboboxes: Category * -> Type * -> Sub Type * */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <TaxonomyCombobox
                    id="product-category"
                    label="Category *"
                    placeholder="Select Category..."
                    value={formData.category}
                    options={formCategoryOptions}
                    allowCreate={true}
                    onCreateNew={handlePromptCreateCategory}
                    onChange={(val, opt) => {
                      const matchedCat = taxonomy.find((c) => c.name === val);
                      const firstType = matchedCat?.types[0];
                      const firstSub = firstType?.sub_types[0];
                      setFormData({
                        ...formData,
                        category: val,
                        category_id: opt?.id ?? matchedCat?.id,
                        type: firstType?.name || "",
                        type_id: firstType?.id,
                        sub_type: firstSub?.name || "",
                        sub_type_id: firstSub?.id,
                      });
                    }}
                  />

                  <TaxonomyCombobox
                    id="product-type"
                    label="Type *"
                    placeholder={
                      formData.category
                        ? "Select Type..."
                        : "Select Category first"
                    }
                    value={formData.type}
                    options={formTypeOptions}
                    disabled={!formData.category}
                    allowCreate={true}
                    badgeColorClass="bg-violet-50 text-violet-700 border-violet-200"
                    onCreateNew={handlePromptCreateType}
                    onChange={(val, opt) => {
                      const matchedType = formTypeList.find(
                        (t) => t.name === val
                      );
                      const firstSub = matchedType?.sub_types[0];
                      setFormData({
                        ...formData,
                        type: val,
                        type_id: opt?.id ?? matchedType?.id,
                        sub_type: firstSub?.name || "",
                        sub_type_id: firstSub?.id,
                      });
                    }}
                  />

                  <TaxonomyCombobox
                    id="product-sub-type"
                    label="Sub-Type *"
                    placeholder={
                      formData.type ? "Select Sub-Type..." : "Select Type first"
                    }
                    value={formData.sub_type}
                    options={formSubTypeOptions}
                    disabled={!formData.type}
                    allowCreate={true}
                    badgeColorClass="bg-emerald-50 text-emerald-700 border-emerald-200"
                    onCreateNew={handlePromptCreateSubType}
                    onChange={(val, opt) => {
                      setFormData({
                        ...formData,
                        sub_type: val,
                        sub_type_id: opt?.id,
                      });
                    }}
                  />
                </div>

                {/* Modal Actions */}
                <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3.5 py-2 rounded-lg border border-zinc-200/90 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    data-testid="submit-product-modal"
                    disabled={formSubmitting || descriptionWordCount > 1000}
                    className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium transition disabled:opacity-50 shadow-2xs"
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

      {/* Product Detail Modal */}
      <ProductDetailModal
        isOpen={Boolean(detailProduct)}
        product={detailProduct}
        onClose={() => setDetailProduct(null)}
      />

      {/* Unified Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel={confirmState.confirmLabel}
        variant={confirmState.variant}
        onConfirm={confirmState.onConfirm}
        onCancel={() =>
          setConfirmState((prev) => ({ ...prev, isOpen: false }))
        }
      />
    </div>
  );
}
