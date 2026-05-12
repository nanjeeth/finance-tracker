import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Transaction, TransactionCreate, Category } from "../types";

interface Props {
  editingTransaction?: Transaction | null;
  onClose: () => void;
  month: string;
}

export default function TransactionForm({ editingTransaction, onClose, month }: Props) {
  const queryClient = useQueryClient();
  const isEditing = !!editingTransaction;

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: api.categories.list,
  });

  const [form, setForm] = useState<TransactionCreate>({
    title: "",
    amount: 0,
    type: "expense",
    date: new Date().toISOString().slice(0, 10),
    note: "",
    category_id: null,
  });

  useEffect(() => {
    if (editingTransaction) {
      setForm({
        title: editingTransaction.title,
        amount: editingTransaction.amount,
        type: editingTransaction.type,
        date: editingTransaction.date,
        note: editingTransaction.note || "",
        category_id: editingTransaction.category_id,
      });
    }
  }, [editingTransaction]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["transactions", month] });
    queryClient.invalidateQueries({ queryKey: ["summary", month] });
  };

  const createMutation = useMutation({
    mutationFn: (data: TransactionCreate) => api.transactions.create(data),
    onSuccess: () => { invalidate(); onClose(); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: TransactionCreate) =>
      api.transactions.update(editingTransaction!.id, data),
    onSuccess: () => { invalidate(); onClose(); },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      category_id: form.category_id || null,
      note: form.note || null,
    };
    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3>{isEditing ? "Edit Transaction" : "Add Transaction"}</h3>

        <label>
          Title
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </label>

        <label>
          Amount
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            value={form.amount || ""}
            onChange={(e) =>
              setForm({ ...form, amount: parseFloat(e.target.value) || 0 })
            }
          />
        </label>

        <label>
          Type
          <select
            value={form.type}
            onChange={(e) =>
              setForm({ ...form, type: e.target.value as "income" | "expense" })
            }
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </label>

        <label>
          Date
          <input
            required
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </label>

        <label>
          Category
          <select
            value={form.category_id ?? ""}
            onChange={(e) =>
              setForm({
                ...form,
                category_id: e.target.value ? parseInt(e.target.value) : null,
              })
            }
          >
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Note
          <input
            value={form.note || ""}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </label>

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            {isEditing ? "Update" : "Add"}
          </button>
        </div>
      </form>
    </div>
  );
}
