export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: string;
  user: UserProfile;
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
  status?: "active" | "inactive" | "archived";
}

export interface SuggestedProductResult {
  product_id?: number;
  name: string;
  brand: string;
  category: string;
  type: string;
  sub_type: string;
  image_url: string;
  match_score: number;
  reasoning: string;
  key_benefits: string[];
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
  brands_breakdown: { brand: string; count: number }[];
}

const TOKEN_KEY = "sales_hub_token";
const EXPIRES_KEY = "sales_hub_token_expires_at";
const USER_KEY = "sales_hub_user";

export function saveAuthSession(data: AuthTokenResponse): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, data.access_token);
  localStorage.setItem(EXPIRES_KEY, data.expires_at);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  // Set cookie with max-age=3600 (1 hour) so Next.js middleware also protects routes
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
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
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
