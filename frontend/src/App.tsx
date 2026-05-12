import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Dashboard from "./components/Dashboard";
import TransactionList from "./components/TransactionList";
import CategoryManager from "./components/CategoryManager";
import ImportCSV from "./components/ImportCSV";
import "./App.css";

const queryClient = new QueryClient();

type Tab = "dashboard" | "transactions" | "categories" | "import";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string) {
  const [y, m] = month.split("-");
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [month, setMonth] = useState(currentMonth);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Finance Tracker</h1>
        <div className="month-nav">
          <button onClick={() => setMonth((m) => shiftMonth(m, -1))}>&larr;</button>
          <span className="month-label">{monthLabel(month)}</span>
          <button onClick={() => setMonth((m) => shiftMonth(m, 1))}>&rarr;</button>
        </div>
      </header>

      <nav className="tabs">
        <button
          className={tab === "dashboard" ? "active" : ""}
          onClick={() => setTab("dashboard")}
        >
          Dashboard
        </button>
        <button
          className={tab === "transactions" ? "active" : ""}
          onClick={() => setTab("transactions")}
        >
          Transactions
        </button>
        <button
          className={tab === "categories" ? "active" : ""}
          onClick={() => setTab("categories")}
        >
          Categories
        </button>
        <button
          className={tab === "import" ? "active" : ""}
          onClick={() => setTab("import")}
        >
          Import
        </button>
      </nav>

      <main className="app-main">
        {tab === "dashboard" && <Dashboard month={month} />}
        {tab === "transactions" && <TransactionList month={month} />}
        {tab === "categories" && <CategoryManager />}
        {tab === "import" && <ImportCSV />}
      </main>
    </div>
  );
}

export default function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}
