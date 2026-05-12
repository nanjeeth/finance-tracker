export type TransactionType = "income" | "expense";

export interface Category {
  id: number;
  name: string;
  color: string;
  budget_limit: number | null;
}

export interface CategoryCreate {
  name: string;
  color: string;
  budget_limit?: number | null;
}

export interface Transaction {
  id: number;
  title: string;
  amount: number;
  type: TransactionType;
  date: string;
  note: string | null;
  category_id: number | null;
  category: Category | null;
}

export interface TransactionCreate {
  title: string;
  amount: number;
  type: TransactionType;
  date: string;
  note?: string | null;
  category_id?: number | null;
}

export interface CategoryBreakdown {
  category: string;
  color: string;
  total: number;
}

export interface MonthlySummary {
  month: string;
  total_income: number;
  total_expenses: number;
  net_savings: number;
  savings_rate: number;
  category_breakdown: CategoryBreakdown[];
  transaction_count: number;
}
