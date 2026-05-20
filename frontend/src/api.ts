import type {
  Transaction,
  TransactionCreate,
  Category,
  CategoryCreate,
  MonthlySummary,
} from "./types";

const BASE = import.meta.env.DEV ? "http://localhost:8000" : "/api";

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

  import: {
    preview: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${BASE}/import/preview`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`${res.status}: ${body}`);
      }
      return res.json() as Promise<{
        bank: string;
        transactions: {
          title: string;
          amount: number;
          type: string;
          date: string;
          suggested_category: string | null;
          fingerprint: string;
        }[];
        total_parsed: number;
        errors: string[];
      }>;
    },
    uploads: () =>
      request<
        {
          filename: string;
          original_name: string;
          uploaded_at: string;
          size_kb: number;
        }[]
      >("/import/uploads"),
    downloadUrl: (filename: string) => `${BASE}/import/uploads/${filename}`,
    confirm: (
      transactions: {
        title: string;
        amount: number;
        type: string;
        date: string;
        category_name: string | null;
        fingerprint: string;
      }[]
    ) =>
      request<{ imported: number; skipped: number; total: number }>(
        "/import/confirm",
        {
          method: "POST",
          body: JSON.stringify({ transactions }),
        }
      ),
  },
};
