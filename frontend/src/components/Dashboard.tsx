import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type { MonthlySummary } from "../types";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function Dashboard({ month }: { month: string }) {
  const { data, isLoading, error } = useQuery<MonthlySummary>({
    queryKey: ["summary", month],
    queryFn: () => api.summary.get(month),
  });

  if (isLoading) return <div className="loading">Loading summary...</div>;
  if (error) return <div className="empty">No data for this month yet.</div>;
  if (!data) return null;

  const maxBreakdown = Math.max(...data.category_breakdown.map((c) => c.total), 1);

  return (
    <div className="dashboard">
      <div className="summary-cards">
        <div className="card income">
          <span className="card-label">Income</span>
          <span className="card-value">{formatCurrency(data.total_income)}</span>
        </div>
        <div className="card expense">
          <span className="card-label">Expenses</span>
          <span className="card-value">{formatCurrency(data.total_expenses)}</span>
        </div>
        <div className={`card ${data.net_savings >= 0 ? "positive" : "negative"}`}>
          <span className="card-label">Net Savings</span>
          <span className="card-value">{formatCurrency(data.net_savings)}</span>
        </div>
        <div className="card neutral">
          <span className="card-label">Savings Rate</span>
          <span className="card-value">{data.savings_rate}%</span>
        </div>
      </div>

      {data.category_breakdown.length > 0 && (
        <div className="breakdown">
          <h3>Expense Breakdown</h3>
          <div className="breakdown-list">
            {data.category_breakdown.map((cat) => (
              <div key={cat.category} className="breakdown-row">
                <div className="breakdown-label">
                  <span
                    className="color-dot"
                    style={{ background: cat.color }}
                  />
                  <span>{cat.category}</span>
                </div>
                <div className="breakdown-bar-wrap">
                  <div
                    className="breakdown-bar"
                    style={{
                      width: `${(cat.total / maxBreakdown) * 100}%`,
                      background: cat.color,
                    }}
                  />
                </div>
                <span className="breakdown-amount">
                  {formatCurrency(cat.total)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="tx-count">
        {data.transaction_count} transaction{data.transaction_count !== 1 && "s"} this month
      </div>
    </div>
  );
}
