import type {
  Transaction,
  TransactionCreate,
  Category,
  CategoryCreate,
  MonthlySummary,
} from "./types";

const BASE = "http://localhost:8000";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  transactions: {
    list: (month?: string) =>
      request<Transaction[]>(
        `/transactions/${month ? `?month=${month}` : ""}`
      ),
    create: (data: TransactionCreate) =>
      request<Transaction>("/transactions/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: number, data: TransactionCreate) =>
      request<Transaction>(`/transactions/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      request<void>(`/transactions/${id}`, { method: "DELETE" }),
  },

  categories: {
    list: () => request<Category[]>("/categories/"),
    create: (data: CategoryCreate) =>
      request<Category>("/categories/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      request<void>(`/categories/${id}`, { method: "DELETE" }),
  },

  summary: {
    get: (month: string) =>
      request<MonthlySummary>(`/summary/?month=${month}`),
  },
};
