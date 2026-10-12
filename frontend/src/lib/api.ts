export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  status?: "active" | "inactive" | "archived";
  is_deleted?: boolean;
  deleted_at?: string;
  created_at: string;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: string;
  user: UserProfile;
}

export interface TaxonomySubType {
  id: number;
  name: string;
  type_id: number;
  created_at: string;
}

export interface TaxonomyType {
  id: number;
  name: string;
  category_id: number;
  sub_types: TaxonomySubType[];
  created_at: string;
}

export interface TaxonomyCategory {
  id: number;
  name: string;
  types: TaxonomyType[];
  created_at: string;
}

export interface SupportingDoc {
  title: string;
  doc_type: string;
  summary: string;
  url: string;
}

export interface CrossSellItem {
  product_name: string;
  category: string;
  reason: string;
}

export interface Product {
  id: number;
  name: string;
  brand: string;
  description: string;
  image_url: string;
  category: string;
  type: string;
  sub_type: string;
  category_id?: number;
  type_id?: number;
  sub_type_id?: number;
  status?: "active" | "inactive" | "archived";
  supporting_documents?: SupportingDoc[];
  cross_sell_products?: CrossSellItem[];
  is_deleted?: boolean;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductCreatePayload {
  name: string;
  brand: string;
  description: string;
  image_url: string;
  category: string;
  type: string;
  sub_type: string;
  category_id?: number;
  type_id?: number;
  sub_type_id?: number;
}

export interface SuggestedProductResult {
  product_id?: number;
  name: string;
  brand: string;
  description?: string;
  category: string;
  type: string;
  sub_type: string;
  category_id?: number;
  type_id?: number;
  sub_type_id?: number;
  image_url: string;
  match_score: number;
  reasoning: string;
  key_benefits: string[];
  supporting_documents?: SupportingDoc[];
  cross_sell_products?: CrossSellItem[];
}

export interface SupportingDocumentResult {
  title: string;
  doc_type: string;
  related_product: string;
  relevance: string;
  url: string;
}

export interface CrossSellingResult {
  product_name: string;
  category: string;
  paired_with: string;
  pitch_reason: string;
}

export interface AISuggestResponse {
  query: string;
  search_mode: string;
  model_used: string;
  inference_source: string;
  executive_summary: string;
  closing_note?: string;
  suggested_products: SuggestedProductResult[];
  supporting_documents: SupportingDocumentResult[];
  cross_selling: CrossSellingResult[];
  created_at: string;
}

export interface SearchHistoryItem {
  id: number;
  query: string;
  search_mode: string;
  model_used: string;
  results: Partial<AISuggestResponse>;
  created_at: string;
}

export interface AnalyticsData {
  total_products: number;
  total_searches: number;
  total_supporting_documents: number;
  total_cross_sell_links: number;
  total_archived?: number;
  categories_breakdown: { category: string; count: number }[];
  types_breakdown?: { type: string; category: string; count: number }[];
  sub_types_breakdown?: { sub_type: string; type: string; count: number }[];
  brands_breakdown: { brand: string; count: number }[];
  search_modes_breakdown?: { mode: string; count: number }[];
  category_coverage?: {
    category: string;
    skus: number;
    docs: number;
    cross_sells: number;
  }[];
}

// High-craft Color Capsule helper for Categories, Types, Sub-Types, and Brands
const CAPSULE_PALETTES = [
  "bg-blue-50/90 text-blue-700 border-blue-200/80",
  "bg-indigo-50/90 text-indigo-700 border-indigo-200/80",
  "bg-emerald-50/90 text-emerald-700 border-emerald-200/80",
  "bg-amber-50/90 text-amber-800 border-amber-200/80",
  "bg-rose-50/90 text-rose-700 border-rose-200/80",
  "bg-cyan-50/90 text-cyan-800 border-cyan-200/80",
  "bg-violet-50/90 text-violet-700 border-violet-200/80",
  "bg-teal-50/90 text-teal-800 border-teal-200/80",
];

export function getCapsuleStyle(
  label: string,
  kind: "category" | "type" | "sub_type" | "brand" = "category"
): string {
  if (!label) return "bg-zinc-100 text-zinc-700 border-zinc-200/80";
  if (kind === "brand") {
    return "bg-zinc-900 text-white border-zinc-800";
  }
  if (kind === "type") {
    return "bg-violet-50/80 text-violet-700 border-violet-200/75";
  }
  if (kind === "sub_type") {
    return "bg-emerald-50/80 text-emerald-700 border-emerald-200/75";
  }
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CAPSULE_PALETTES[Math.abs(hash) % CAPSULE_PALETTES.length];
}

const TOKEN_KEY = "sales_hub_token";
const EXPIRES_KEY = "sales_hub_token_expires_at";
const USER_KEY = "sales_hub_user";

export function saveAuthSession(data: AuthTokenResponse): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, data.access_token);
  localStorage.setItem(EXPIRES_KEY, data.expires_at);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  document.cookie = `${TOKEN_KEY}=${data.access_token}; path=/; max-age=${data.expires_in}; SameSite=Lax`;
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRES_KEY);
  localStorage.removeItem(USER_KEY);
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0; SameSite=Lax`;
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem(TOKEN_KEY);
  const expiresAt = localStorage.getItem(EXPIRES_KEY);
  if (!token) return null;

  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    clearAuthSession();
    return null;
  }
  return token;
}

export function getStoredUser(): UserProfile | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getTokenExpiresAt(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(EXPIRES_KEY);
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearAuthSession();
    if (
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/login")
    ) {
      window.location.href = "/login";
    }
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.detail || "Session expired or unauthorized");
  }

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.detail || `API Error (${response.status})`);
  }

  return response.json();
}

export async function uploadProductImage(
  file: File
): Promise<{ image_url: string; filename: string }> {
  const token = getAuthToken();
  const formData = new FormData();
  formData.append("file", file);

  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/api/products/upload-image`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.detail || `Image Upload Error (${response.status})`);
  }

  return response.json();
}
