import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

interface PreviewTx {
  title: string;
  amount: number;
  type: string;
  date: string;
  suggested_category: string | null;
  fingerprint: string;
  selected: boolean;
  source: string;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

export default function ImportCSV() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [banks, setBanks] = useState<string[]>([]);
  const [preview, setPreview] = useState<PreviewTx[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [parseProgress, setParseProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
  } | null>(null);

  const handleFiles = useCallback(async (files: File[]) => {
    const csvFiles = files.filter((f) => f.name.endsWith(".csv"));
    if (csvFiles.length === 0) {
      setErrors(["No CSV files found. Please upload .csv files."]);
      return;
    }

    setLoading(true);
    setResult(null);
    setErrors([]);
    setPreview([]);
    setBanks([]);
    setParseProgress({ done: 0, total: csvFiles.length });

    const allTransactions: PreviewTx[] = [];
    const allErrors: string[] = [];
    const detectedBanks: string[] = [];

    for (let i = 0; i < csvFiles.length; i++) {
      const file = csvFiles[i];
      setParseProgress({ done: i, total: csvFiles.length });

      try {
        const data = await api.import.preview(file);
        if (data.bank && !detectedBanks.includes(data.bank)) {
          detectedBanks.push(data.bank);
        }
        allTransactions.push(
          ...data.transactions.map((tx) => ({
            ...tx,
            selected: true,
            source: file.name,
          }))
        );
        if (data.errors.length > 0) {
          allErrors.push(
            ...data.errors.map((e) => `${file.name}: ${e}`)
          );
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to parse";
        allErrors.push(`${file.name}: ${msg}`);
      }
    }

    // Deduplicate across files by fingerprint
    const seen = new Set<string>();
    const deduplicated: PreviewTx[] = [];
    for (const tx of allTransactions) {
      if (!seen.has(tx.fingerprint)) {
        seen.add(tx.fingerprint);
        deduplicated.push(tx);
      }
    }

    const dupsRemoved = allTransactions.length - deduplicated.length;
    if (dupsRemoved > 0) {
      allErrors.push(
        `${dupsRemoved} duplicate transaction${dupsRemoved !== 1 ? "s" : ""} across files were removed`
      );
    }

    // Sort by date descending
    deduplicated.sort((a, b) => b.date.localeCompare(a.date));

    setBanks(detectedBanks);
    setPreview(deduplicated);
    setErrors(allErrors);
    setParseProgress({ done: csvFiles.length, total: csvFiles.length });
    setLoading(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) handleFiles(files);
    },
    [handleFiles]
  );

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) handleFiles(files);
  };

  const toggleAll = (checked: boolean) => {
    setPreview((prev) => prev.map((tx) => ({ ...tx, selected: checked })));
  };

  const toggleOne = (index: number) => {
    setPreview((prev) =>
      prev.map((tx, i) =>
        i === index ? { ...tx, selected: !tx.selected } : tx
      )
    );
  };

  const toggleSource = (source: string, checked: boolean) => {
    setPreview((prev) =>
      prev.map((tx) =>
        tx.source === source ? { ...tx, selected: checked } : tx
      )
    );
  };

  const handleImport = async () => {
    const selected = preview.filter((tx) => tx.selected);
    if (selected.length === 0) return;

    setLoading(true);
    try {
      const res = await api.import.confirm(
        selected.map((tx) => ({
          title: tx.title,
          amount: tx.amount,
          type: tx.type,
          date: tx.date,
          category_name: tx.suggested_category,
          fingerprint: tx.fingerprint,
        }))
      );
      setResult(res);
      setPreview([]);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      refetchUploads();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Import failed";
      setErrors([msg]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPreview([]);
    setBanks([]);
    setErrors([]);
    setResult(null);
    setParseProgress({ done: 0, total: 0 });
    if (fileRef.current) fileRef.current.value = "";
  };

  const { data: uploads = [], refetch: refetchUploads } = useQuery({
    queryKey: ["uploads"],
    queryFn: api.import.uploads,
  });

  const selectedCount = preview.filter((tx) => tx.selected).length;
  const sources = [...new Set(preview.map((tx) => tx.source))];

  return (
    <div className="import-csv">
      <h3>Import Bank Statements</h3>

      {!preview.length && !result && (
        <>
          <div
            className={`drop-zone ${dragOver ? "drag-over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
          >
            <div className="drop-icon">&#128196;</div>
            <p className="drop-text">
              Drag & drop your CSV files here, or click to browse
            </p>
            <p className="drop-hint">
              Upload multiple files at once — supports Chase, Bank of America, Amex, Capital One, Citi, Discover, Wells Fargo, Apple Card
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              multiple
              onChange={onFileSelect}
              hidden
            />
          </div>

          {loading && (
            <div className="loading">
              Parsing file {parseProgress.done + 1} of {parseProgress.total}...
            </div>
          )}
        </>
      )}

      {errors.length > 0 && (
        <div className="import-errors">
          {errors.map((err, i) => (
            <p key={i}>{err}</p>
          ))}
        </div>
      )}

      {result && (
        <div className="import-result">
          <div className="result-icon">&#10003;</div>
          <h4>Import Complete</h4>
          <p>
            {result.imported} transaction{result.imported !== 1 && "s"} imported
            {result.skipped > 0 &&
              `, ${result.skipped} duplicate${result.skipped !== 1 ? "s" : ""} skipped`}
          </p>
          <button className="btn-primary" onClick={handleReset}>
            Import More
          </button>
        </div>
      )}

      {preview.length > 0 && (
        <div className="import-preview">
          <div className="preview-header">
            <div className="bank-badges">
              {banks.map((b) => (
                <span key={b} className="bank-badge">{b}</span>
              ))}
            </div>
            <span className="preview-count">
              {selectedCount} of {preview.length} selected
            </span>
          </div>

          {sources.length > 1 && (
            <div className="source-filters">
              {sources.map((source) => {
                const count = preview.filter((tx) => tx.source === source).length;
                const checked = preview.filter((tx) => tx.source === source).every((tx) => tx.selected);
                return (
                  <label key={source} className="source-filter">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggleSource(source, e.target.checked)}
                    />
                    <span className="source-name">{source}</span>
                    <span className="source-count">({count})</span>
                  </label>
                );
              })}
            </div>
          )}

          <div className="preview-controls">
            <label className="select-all">
              <input
                type="checkbox"
                checked={selectedCount === preview.length}
                onChange={(e) => toggleAll(e.target.checked)}
              />
              Select all
            </label>
            <button
              className="btn-primary"
              onClick={handleImport}
              disabled={loading || selectedCount === 0}
            >
              {loading ? "Importing..." : `Import ${selectedCount} transaction${selectedCount !== 1 ? "s" : ""}`}
            </button>
            <button className="btn-secondary" onClick={handleReset}>
              Cancel
            </button>
          </div>

          <div className="preview-list">
            {preview.map((tx, i) => (
              <div
                key={i}
                className={`preview-row ${tx.selected ? "" : "deselected"}`}
                onClick={() => toggleOne(i)}
              >
                <input
                  type="checkbox"
                  checked={tx.selected}
                  onChange={() => toggleOne(i)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="preview-info">
                  <span className="preview-title">{tx.title}</span>
                  <span className="preview-meta">
                    {new Date(tx.date + "T00:00:00").toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {tx.suggested_category && (
                      <span className="category-tag">
                        {tx.suggested_category}
                      </span>
                    )}
                    {sources.length > 1 && (
                      <span className="source-tag">{tx.source}</span>
                    )}
                  </span>
                </div>
                <span className={`preview-amount ${tx.type}`}>
                  {tx.type === "income" ? "+" : "-"}
                  {formatCurrency(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {uploads.length > 0 && !preview.length && (
        <div className="upload-history">
          <h3>Upload History</h3>
          <div className="upload-list">
            {uploads.map((u) => (
              <div key={u.filename} className="upload-item">
                <div className="upload-info">
                  <span className="upload-name">{u.original_name}</span>
                  <span className="upload-meta">
                    {u.uploaded_at} &middot; {u.size_kb} KB
                  </span>
                </div>
                <a
                  className="btn-secondary"
                  href={api.import.downloadUrl(u.filename)}
                  download
                >
                  Download
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
