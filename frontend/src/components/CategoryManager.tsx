import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Category } from "../types";

const PRESET_COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981",
  "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6",
];

export default function CategoryManager() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [budgetLimit, setBudgetLimit] = useState("");

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: api.categories.list,
  });

  const createMutation = useMutation({
    mutationFn: api.categories.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setName("");
      setColor(PRESET_COLORS[0]);
      setBudgetLimit("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.categories.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({
      name: name.trim(),
      color,
      budget_limit: budgetLimit ? parseFloat(budgetLimit) : null,
    });
  };

  return (
    <div className="category-manager">
      <h3>Categories</h3>

      <form className="category-form" onSubmit={handleSubmit}>
        <input
          placeholder="Category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <div className="color-picker">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`color-swatch ${c === color ? "active" : ""}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <input
          type="number"
          placeholder="Monthly budget (optional)"
          value={budgetLimit}
          onChange={(e) => setBudgetLimit(e.target.value)}
          min="0"
          step="1"
        />
        <button type="submit" className="btn-primary">
          Add Category
        </button>
      </form>

      {isLoading && <div className="loading">Loading...</div>}

      <div className="category-list">
        {categories.map((cat) => (
          <div key={cat.id} className="category-item">
            <span className="color-dot" style={{ background: cat.color }} />
            <span className="category-name">{cat.name}</span>
            {cat.budget_limit && (
              <span className="category-budget">
                Budget: {new Intl.NumberFormat("en-IN", {
                  style: "currency",
                  currency: "INR",
                  maximumFractionDigits: 0,
                }).format(cat.budget_limit)}
              </span>
            )}
            <button
              className="btn-icon danger"
              title="Delete"
              onClick={() => deleteMutation.mutate(cat.id)}
            >
              &times;
            </button>
          </div>
        ))}
        {!isLoading && categories.length === 0 && (
          <div className="empty">No categories yet. Add one above!</div>
        )}
      </div>
    </div>
  );
}
