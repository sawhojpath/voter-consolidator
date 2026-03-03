import { useState, useCallback, useRef, useEffect } from "react";
import Papa from "papaparse";
import { createClient } from "@supabase/supabase-js";

// ── Supabase client ───────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

const EXPECTED_COLUMNS = [
  "source_file", "serial_no", "epic_id", "name",
  "relation_details", "house_no", "age", "gender",
  "status", "inferred_religion"
];

const STATUS_COLORS = {
  "Deleted":            { bg: "#fef2f2", text: "#991b1b", border: "#fca5a5" },
  "Under Adjudication": { bg: "#fffbeb", text: "#92400e", border: "#fcd34d" },
};
const RELIGION_COLORS = {
  "Muslim":    { bg: "#eff6ff", text: "#1e40af", dot: "#3b82f6" },
  "Hindu":     { bg: "#f0fdf4", text: "#166534", dot: "#22c55e" },
  "Uncertain": { bg: "#f9fafb", text: "#374151", dot: "#9ca3af" },
};

// ── helpers ───────────────────────────────────────────────────────────────────

function buildFileStats(rows) {
  const map = {};
  rows.forEach(r => {
    const f = r.source_file || "unknown";
    if (!map[f]) map[f] = { filename: f, total: 0, deleted: 0, adjudication: 0, muslim: 0, hindu: 0, uncertain: 0 };
    map[f].total++;
    const st = (r.status || "").toLowerCase();
    const re = (r.inferred_religion || "").toLowerCase();
    if (st.includes("delet"))      map[f].deleted++;
    if (st.includes("adjudicat"))  map[f].adjudication++;
    if (re === "muslim")           map[f].muslim++;
    else if (re === "hindu")       map[f].hindu++;
    else                           map[f].uncertain++;
  });
  return Object.values(map);
}

// ── small UI components ───────────────────────────────────────────────────────

function Badge({ label, type }) {
  const s = type === "status"
    ? (STATUS_COLORS[label]   || { bg: "#f3f4f6", text: "#374151", border: "#d1d5db" })
    : (RELIGION_COLORS[label] || { bg: "#f3f4f6", text: "#374151", dot: "#9ca3af" });

  return type === "status" ? (
    <span style={{
      background: s.bg, color: s.text, border: `1px solid ${s.border}`,
      padding: "2px 10px", borderRadius: 20,
      fontSize: 11, fontWeight: 700, whiteSpace: "nowrap"
    }}>{label}</span>
  ) : (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: s.bg, color: s.text,
      padding: "2px 10px", borderRadius: 20,
      fontSize: 11, fontWeight: 600, whiteSpace: "nowrap"
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {label}
    </span>
  );
}

function StatCard({ label, value, color, loading }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
      padding: "18px 22px", borderTop: `3px solid ${color}`, minWidth: 120
    }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: "#111827", fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1 }}>
        {loading ? <span style={{ color: "#d1d5db" }}>…</span> : value}
      </div>
      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </div>
    </div>
  );
}

function DropZone({ onFiles, disabled }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith(".csv"));
    if (files.length) onFiles(files);
  }, [onFiles, disabled]);

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current.click()}
      style={{
        border: `2px dashed ${dragging ? "#d97706" : "#d1d5db"}`,
        borderRadius: 16, padding: "48px 32px", textAlign: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        background: dragging ? "#fffbeb" : "#fafafa",
        opacity: disabled ? 0.6 : 1, transition: "all 0.2s ease",
      }}
    >
      <input ref={inputRef} type="file" accept=".csv" multiple
        onChange={e => { onFiles(Array.from(e.target.files)); e.target.value = ""; }}
        style={{ display: "none" }} />
      <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
        {dragging ? "Drop CSV files here" : disabled ? "Uploading…" : "Upload CSV Files"}
      </div>
      <div style={{ fontSize: 13, color: "#9ca3af" }}>Drag & drop or click to browse</div>
      <div style={{
        display: "inline-block", marginTop: 16,
        background: "#d97706", color: "#fff",
        padding: "8px 24px", borderRadius: 8, fontSize: 13, fontWeight: 700
      }}>Choose Files</div>
    </div>
  );
}

function Toast({ message, type = "info", onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  const accent = type === "error" ? "#ef4444" : type === "success" ? "#22c55e" : "#d97706";
  return (
    <div style={{
      position: "fixed", bottom: 28, right: 28, zIndex: 9999,
      background: "#1c1917", color: "#fff",
      padding: "12px 22px", borderRadius: 10, fontSize: 13, fontWeight: 600,
      boxShadow: "0 4px 20px rgba(0,0,0,0.3)", borderLeft: `4px solid ${accent}`,
      animation: "fadeIn 0.3s ease", maxWidth: 360
    }}>{message}</div>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 60 }}>
      <div style={{
        width: 36, height: 36, border: "3px solid #e5e7eb",
        borderTop: "3px solid #d97706", borderRadius: "50%",
        animation: "spin 0.8s linear infinite"
      }} />
    </div>
  );
}

// ── main app ──────────────────────────────────────────────────────────────────

export default function App() {
  const [allRows, setAllRows]     = useState([]);
  const [fileStats, setFileStats] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast]         = useState(null);
  const [activeTab, setActiveTab] = useState("table");
  const [filterStatus, setFilterStatus]   = useState("All");
  const [filterReligion, setFilterReligion] = useState("All");
  const [filterFile, setFilterFile]       = useState("All");
  const [search, setSearch]               = useState("");

  // ── fetch all rows from Supabase on mount ──
  useEffect(() => {
    fetchAllRows();
  }, []);

  async function fetchAllRows() {
    setLoading(true);
    const { data, error } = await supabase
      .from("voter_records")
      .select("*")
      .order("uploaded_at", { ascending: true });

    if (error) {
      setToast({ message: `❌ Failed to load data: ${error.message}`, type: "error" });
    } else {
      setAllRows(data || []);
      setFileStats(buildFileStats(data || []));
    }
    setLoading(false);
  }

  // ── upload CSV files ──
  // eslint-disable-next-line react-hooks/exhaustive-deps
const processFiles = useCallback((files) => {
    const existingFiles = new Set(allRows.map(r => r.source_file));
    const dupeFiles = [];

    let pending = files.length;
    const allNewRows = [];

    files.forEach(file => {
      if (existingFiles.has(file.name)) {
        dupeFiles.push(file.name);
        pending--;
        if (pending === 0) finishUpload(allNewRows, dupeFiles);
        return;
      }

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          const rows = result.data.map(row => ({
            source_file:      row.source_file || file.name,
            serial_no:        row.serial_no || null,
            epic_id:          row.epic_id || null,
            name:             row.name || null,
            relation_details: row.relation_details || null,
            house_no:         row.house_no || null,
            age:              row.age || null,
            gender:           row.gender || null,
            status:           row.status || null,
            inferred_religion: row.inferred_religion || null,
          }));
          allNewRows.push(...rows);
          pending--;
          if (pending === 0) finishUpload(allNewRows, dupeFiles);
        },
        error: () => {
          setToast({ message: `❌ Failed to parse ${file.name}`, type: "error" });
          pending--;
          if (pending === 0) finishUpload(allNewRows, dupeFiles);
        }
      });
    });
  }, [allRows]);

  async function finishUpload(newRows, dupeFiles) {
    if (dupeFiles.length > 0) {
      setToast({ message: `⚠️ Skipped ${dupeFiles.length} already-uploaded file(s)`, type: "info" });
    }
    if (newRows.length === 0) return;

    setUploading(true);

    // Insert in batches of 500 to stay within Supabase limits
    const BATCH = 500;
    let insertedCount = 0;
    let errorMsg = null;

    for (let i = 0; i < newRows.length; i += BATCH) {
      const batch = newRows.slice(i, i + BATCH);
      const { error } = await supabase.from("voter_records").insert(batch);
      if (error) { errorMsg = error.message; break; }
      insertedCount += batch.length;
    }

    setUploading(false);

    if (errorMsg) {
      setToast({ message: `❌ Upload error: ${errorMsg}`, type: "error" });
    } else {
      setToast({ message: `✅ ${insertedCount} records saved to database`, type: "success" });
      fetchAllRows(); // refresh from DB
    }
  }

  // ── delete a single file's records ──
  async function removeFile(filename) {
    const { error } = await supabase
      .from("voter_records")
      .delete()
      .eq("source_file", filename);

    if (error) {
      setToast({ message: `❌ Failed to delete: ${error.message}`, type: "error" });
    } else {
      setToast({ message: `🗑️ Removed ${filename}`, type: "info" });
      fetchAllRows();
    }
  }

  // ── clear all records ──
  async function clearAll() {
    if (!window.confirm("Delete ALL records from the database? This cannot be undone.")) return;
    const { error } = await supabase
      .from("voter_records")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all rows

    if (error) {
      setToast({ message: `❌ Failed to clear: ${error.message}`, type: "error" });
    } else {
      setAllRows([]); setFileStats([]);
      setFilterStatus("All"); setFilterReligion("All");
      setFilterFile("All"); setSearch("");
      setToast({ message: "🗑️ All records deleted", type: "info" });
    }
  }

  // ── export filtered rows as CSV ──
  function downloadCSV() {
    const exportRows = filteredRows.map(r => {
      const obj = {};
      EXPECTED_COLUMNS.forEach(c => { obj[c] = r[c] || ""; });
      return obj;
    });
    const csv = Papa.unparse(exportRows);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "consolidated_voter_data.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  // ── derived data ──
  const uniqueFiles = [...new Set(allRows.map(r => r.source_file))];

  const filteredRows = allRows.filter(r => {
    if (filterStatus !== "All"   && !(r.status || "").toLowerCase().includes(filterStatus.toLowerCase())) return false;
    if (filterReligion !== "All" && (r.inferred_religion || "").toLowerCase() !== filterReligion.toLowerCase()) return false;
    if (filterFile !== "All"     && r.source_file !== filterFile) return false;
    if (search) {
      const s = search.toLowerCase();
      return (r.name || "").toLowerCase().includes(s) ||
             (r.epic_id || "").toLowerCase().includes(s) ||
             (r.serial_no || "").toLowerCase().includes(s);
    }
    return true;
  });

  const totalDeleted = allRows.filter(r => (r.status || "").toLowerCase().includes("delet")).length;
  const totalAdj     = allRows.filter(r => (r.status || "").toLowerCase().includes("adjudicat")).length;
  const totalMuslim  = allRows.filter(r => (r.inferred_religion || "").toLowerCase() === "muslim").length;
  const totalHindu   = allRows.filter(r => (r.inferred_religion || "").toLowerCase() === "hindu").length;

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#f8f7f4", fontFamily: "'DM Sans','Segoe UI',sans-serif", color: "#1f2937" }}>

      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}

      {/* Header */}
      <div style={{
        background: "#1c1917", color: "#fff", padding: "24px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "3px solid #d97706"
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>🗳️</span>
            <span style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Playfair Display',Georgia,serif", letterSpacing: -0.5 }}>
              VoterRoll Consolidator
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#a8a29e", marginTop: 4, letterSpacing: 0.3 }}>
            West Bengal Electoral Roll · Adjudication & Deletion Tracker
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* DB status pill */}
          <span style={{
            fontSize: 11, color: "#86efac", background: "#14532d22",
            border: "1px solid #16a34a55", padding: "4px 10px",
            borderRadius: 6, fontFamily: "monospace"
          }}>🟢 Supabase connected</span>

          {allRows.length > 0 && (
            <>
              <button onClick={downloadCSV} style={{
                background: "#d97706", color: "#fff", border: "none",
                borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer"
              }}>⬇ Export CSV</button>
              <button onClick={clearAll} style={{
                background: "transparent", color: "#a8a29e",
                border: "1px solid #44403c", borderRadius: 8,
                padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer"
              }}>✕ Clear All</button>
            </>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "28px 24px" }}>

        {loading ? <Spinner /> : allRows.length === 0 ? (

          /* ── Empty state ── */
          <div style={{ maxWidth: 600, margin: "60px auto" }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <h2 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 26, fontWeight: 800, color: "#1c1917", margin: 0 }}>
                Upload Your Extracted CSVs
              </h2>
              <p style={{ color: "#6b7280", marginTop: 8, fontSize: 14 }}>
                Data is stored in a hosted Supabase database — accessible from any device, persists forever.
              </p>
            </div>
            <DropZone onFiles={processFiles} disabled={uploading} />
            <div style={{
              marginTop: 16, background: "#eff6ff", border: "1px solid #bfdbfe",
              borderRadius: 10, padding: "12px 16px", fontSize: 12, color: "#1e40af",
              display: "flex", gap: 8
            }}>
              <span>🗄️</span>
              <span>
                <strong>Powered by Supabase.</strong> Records are stored in a real PostgreSQL database.
                Data persists across all devices and browsers — not just this one.
              </span>
            </div>
            <div style={{ marginTop: 14, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Expected CSV Columns
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {EXPECTED_COLUMNS.map(col => (
                  <span key={col} style={{ background: "#f3f4f6", color: "#374151", padding: "3px 10px", borderRadius: 6, fontSize: 11, fontFamily: "monospace" }}>
                    {col}
                  </span>
                ))}
              </div>
            </div>
          </div>

        ) : (

          /* ── Main dashboard ── */
          <>
            {/* Upload more banner */}
            <div style={{
              background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
              padding: "14px 20px", display: "flex", alignItems: "center",
              justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10
            }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                <strong style={{ color: "#1f2937" }}>{fileStats.length} file{fileStats.length !== 1 ? "s" : ""}</strong> in database ·{" "}
                <strong style={{ color: "#1f2937" }}>{allRows.length}</strong> total records ·{" "}
                <span style={{ color: "#1e40af", fontWeight: 600 }}>🗄️ Supabase</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {uploading && (
                  <span style={{ fontSize: 12, color: "#d97706", fontWeight: 600 }}>⏳ Saving to database…</span>
                )}
                <label style={{
                  background: uploading ? "#f3f4f6" : "#f3f4f6",
                  color: "#374151", border: "1px solid #d1d5db",
                  borderRadius: 8, padding: "6px 14px", fontSize: 12,
                  fontWeight: 700, cursor: uploading ? "not-allowed" : "pointer",
                  opacity: uploading ? 0.6 : 1
                }}>
                  + Add More CSVs
                  <input type="file" accept=".csv" multiple disabled={uploading}
                    onChange={e => { processFiles(Array.from(e.target.files)); e.target.value = ""; }}
                    style={{ display: "none" }} />
                </label>
                <button onClick={fetchAllRows} style={{
                  background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db",
                  borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer"
                }} title="Refresh from database">🔄</button>
              </div>
            </div>

            {/* Stat cards */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
              <StatCard label="Total Records"      value={allRows.length} color="#d97706" />
              <StatCard label="Deleted"            value={totalDeleted}   color="#ef4444" />
              <StatCard label="Under Adjudication" value={totalAdj}       color="#f59e0b" />
              <StatCard label="Muslim"             value={totalMuslim}    color="#3b82f6" />
              <StatCard label="Hindu"              value={totalHindu}     color="#22c55e" />
              <StatCard label="PDFs Processed"     value={fileStats.length} color="#8b5cf6" />
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "2px solid #e5e7eb" }}>
              {["table", "per-pdf"].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  padding: "10px 20px", fontSize: 13, fontWeight: 700,
                  background: "none", border: "none", cursor: "pointer",
                  color: activeTab === tab ? "#d97706" : "#6b7280",
                  borderBottom: activeTab === tab ? "2px solid #d97706" : "2px solid transparent",
                  marginBottom: -2
                }}>
                  {tab === "table" ? "📋 All Records" : "📁 Per-PDF Summary"}
                </button>
              ))}
            </div>

            {/* ── All Records tab ── */}
            {activeTab === "table" && (
              <>
                <div style={{
                  background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
                  padding: "14px 18px", display: "flex", gap: 12,
                  flexWrap: "wrap", alignItems: "center", marginBottom: 16
                }}>
                  <input
                    placeholder="🔍 Search name, EPIC, serial..."
                    value={search} onChange={e => setSearch(e.target.value)}
                    style={{
                      flex: 1, minWidth: 200, padding: "8px 12px",
                      border: "1px solid #d1d5db", borderRadius: 8,
                      fontSize: 13, outline: "none", fontFamily: "inherit"
                    }}
                  />
                  {[
                    { value: filterStatus,   setter: setFilterStatus,   options: ["All", "Deleted", "Adjudication"] },
                    { value: filterReligion, setter: setFilterReligion, options: ["All", "Muslim", "Hindu", "Uncertain"] },
                    { value: filterFile,     setter: setFilterFile,     options: ["All", ...uniqueFiles] },
                  ].map(({ value, setter, options }, i) => (
                    <select key={i} value={value} onChange={e => setter(e.target.value)} style={{
                      padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8,
                      fontSize: 13, background: "#fff", fontFamily: "inherit", cursor: "pointer"
                    }}>
                      {options.map(o => <option key={o}>{o}</option>)}
                    </select>
                  ))}
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>
                    {filteredRows.length} result{filteredRows.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "#1c1917" }}>
                          {EXPECTED_COLUMNS.map(col => (
                            <th key={col} style={{
                              padding: "11px 14px", textAlign: "left", fontWeight: 700,
                              whiteSpace: "nowrap", fontSize: 11, textTransform: "uppercase",
                              letterSpacing: 0.5, color: "#d6d3d1"
                            }}>{col.replace(/_/g, " ")}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.length === 0 ? (
                          <tr>
                            <td colSpan={EXPECTED_COLUMNS.length} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                              No records match your filters.
                            </td>
                          </tr>
                        ) : filteredRows.map((row, i) => (
                          <tr key={row.id || i} style={{ background: i % 2 === 0 ? "#fff" : "#fafaf9", borderBottom: "1px solid #f3f4f6" }}>
                            {EXPECTED_COLUMNS.map(col => (
                              <td key={col} style={{ padding: "10px 14px", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {col === "status" ? <Badge label={row[col] || "—"} type="status" />
                                  : col === "inferred_religion" ? <Badge label={row[col] || "—"} type="religion" />
                                  : col === "source_file" ? <span style={{ fontSize: 11, color: "#8b5cf6", fontFamily: "monospace", fontWeight: 600 }}>{row[col] || "—"}</span>
                                  : <span title={row[col]}>{row[col] || "—"}</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* ── Per-PDF tab ── */}
            {activeTab === "per-pdf" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {fileStats.map((stat, i) => (
                  <div key={i} style={{
                    background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
                    padding: "18px 22px", display: "flex", alignItems: "center",
                    justifyContent: "space-between", flexWrap: "wrap", gap: 12
                  }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#1f2937", fontFamily: "monospace" }}>{stat.filename}</div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>{stat.total} voter{stat.total !== 1 ? "s" : ""} flagged</div>
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {[
                        { label: "Deleted",      val: stat.deleted,      color: "#ef4444", bg: "#fef2f2" },
                        { label: "Adjudication", val: stat.adjudication, color: "#d97706", bg: "#fffbeb" },
                        { label: "Muslim",       val: stat.muslim,       color: "#3b82f6", bg: "#eff6ff" },
                        { label: "Hindu",        val: stat.hindu,        color: "#16a34a", bg: "#f0fdf4" },
                        { label: "Uncertain",    val: stat.uncertain,    color: "#6b7280", bg: "#f9fafb" },
                      ].map(({ label, val, color, bg }) => (
                        <div key={label} style={{
                          background: bg, color, border: `1px solid ${color}30`,
                          borderRadius: 8, padding: "6px 14px", textAlign: "center", minWidth: 80
                        }}>
                          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Playfair Display',Georgia,serif" }}>{val}</div>
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => { setFilterFile(stat.filename); setActiveTab("table"); }} style={{
                        background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db",
                        borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer"
                      }}>View →</button>
                      <button onClick={() => removeFile(stat.filename)} style={{
                        background: "#fef2f2", color: "#991b1b", border: "1px solid #fca5a5",
                        borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer"
                      }}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin   { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
