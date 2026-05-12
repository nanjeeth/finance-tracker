import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Transaction } from "../types";
import TransactionForm from "./TransactionForm";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function TransactionList({ month }: { month: string }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["transactions", month],
    queryFn: () => api.transactions.list(month),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.transactions.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions", month] });
      queryClient.invalidateQueries({ queryKey: ["summary", month] });
    },
  });

  const handleEdit = (tx: Transaction) => {
    setEditing(tx);
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setEditing(null);
  };

  return (
    <div className="transaction-list">
      <div className="section-header">
        <h3>Transactions</h3>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + Add
        </button>
      </div>

      {isLoading && <div className="loading">Loading...</div>}

      {!isLoading && transactions.length === 0 && (
        <div className="empty">No transactions this month. Add one to get started!</div>
      )}

      <div className="tx-items">
        {transactions.map((tx) => (
          <div key={tx.id} className="tx-item">
            <div className="tx-left">
              <span
                className="color-dot"
                style={{
                  background: tx.category?.color || "#94a3b8",
                }}
              />
              <div className="tx-info">
                <span className="tx-title">{tx.title}</span>
                <span className="tx-meta">
                  {tx.category?.name || "Uncategorized"} &middot;{" "}
                  {new Date(tx.date).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                  {tx.note && ` · ${tx.note}`}
                </span>
              </div>
            </div>
            <div className="tx-right">
              <span className={`tx-amount ${tx.type}`}>
                {tx.type === "income" ? "+" : "-"}
                {formatCurrency(tx.amount)}
              </span>
              <div className="tx-actions">
                <button
                  className="btn-icon"
                  title="Edit"
                  onClick={() => handleEdit(tx)}
                >
                  &#9998;
                </button>
                <button
                  className="btn-icon danger"
                  title="Delete"
                  onClick={() => deleteMutation.mutate(tx.id)}
                >
                  &times;
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <TransactionForm
          editingTransaction={editing}
          onClose={handleClose}
          month={month}
        />
      )}
    </div>
  );
}
