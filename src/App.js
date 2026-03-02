import { useState, useCallback, useRef } from "react";
import Papa from "papaparse";

const EXPECTED_COLUMNS = [
  "source_file", "serial_no", "epic_id", "name",
  "relation_details", "house_no", "age", "gender",
  "status", "inferred_religion"
];

const STATUS_COLORS = {
  "Deleted": { bg: "#fef2f2", text: "#991b1b", border: "#fca5a5" },
  "Under Adjudication": { bg: "#fffbeb", text: "#92400e", border: "#fcd34d" },
};

const RELIGION_COLORS = {
  "Muslim": { bg: "#eff6ff", text: "#1e40af", dot: "#3b82f6" },
  "Hindu": { bg: "#f0fdf4", text: "#166534", dot: "#22c55e" },
  "Uncertain": { bg: "#f9fafb", text: "#374151", dot: "#9ca3af" },
};

function Badge({ label, type }) {
  const style = type === "status"
    ? STATUS_COLORS[label] || { bg: "#f3f4f6", text: "#374151", border: "#d1d5db" }
    : RELIGION_COLORS[label] || { bg: "#f3f4f6", text: "#374151", dot: "#9ca3af" };

  if (type === "status") {
    return (
      <span style={{
        background: style.bg, color: style.text,
        border: `1px solid ${style.border}`,
        padding: "2px 10px", borderRadius: 20,
        fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
        whiteSpace: "nowrap", fontFamily: "inherit"
      }}>{label}</span>
    );
  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: style.bg, color: style.text,
      padding: "2px 10px", borderRadius: 20,
      fontSize: 11, fontWeight: 600, whiteSpace: "nowrap"
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: style.dot, flexShrink: 0 }} />
      {label}
    </span>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e5e7eb",
      borderRadius: 12, padding: "18px 22px",
      borderTop: `3px solid ${color}`,
      minWidth: 120
    }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: "#111827", fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function DropZone({ onFiles }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith(".csv"));
    if (files.length) onFiles(files);
  }, [onFiles]);

  const handleChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length) onFiles(files);
    e.target.value = "";
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current.click()}
      style={{
        border: `2px dashed ${dragging ? "#d97706" : "#d1d5db"}`,
        borderRadius: 16, padding: "48px 32px",
        textAlign: "center", cursor: "pointer",
        background: dragging ? "#fffbeb" : "#fafafa",
        transition: "all 0.2s ease",
      }}
    >
      <input ref={inputRef} type="file" accept=".csv" multiple onChange={handleChange} style={{ display: "none" }} />
      <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
        {dragging ? "Drop CSV files here" : "Upload CSV Files"}
      </div>
      <div style={{ fontSize: 13, color: "#9ca3af" }}>
        Drag & drop multiple CSVs or click to browse
      </div>
      <div style={{
        display: "inline-block", marginTop: 16,
        background: "#d97706", color: "#fff",
        padding: "8px 24px", borderRadius: 8,
        fontSize: 13, fontWeight: 700
      }}>
        Choose Files
      </div>
    </div>
  );
}

export default function App() {
  const [allRows, setAllRows] = useState([]);
  const [fileStats, setFileStats] = useState([]);
  const [errors, setErrors] = useState([]);
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterReligion, setFilterReligion] = useState("All");
  const [filterFile, setFilterFile] = useState("All");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("table");

  const processFiles = useCallback((files) => {
    const newErrors = [];
    let pendingFiles = files.length;
    const newRows = [];
    const newStats = [];

    files.forEach((file) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          const rows = result.data;
          const enriched = rows.map((row) => ({
            ...row,
            source_file: row.source_file || file.name,
          }));
          newRows.push(...enriched);

          // Per-file stats
          const deleted = enriched.filter(r =>
            (r.status || "").toLowerCase().includes("delet")).length;
          const adjudication = enriched.filter(r =>
            (r.status || "").toLowerCase().includes("adjudicat")).length;
          const muslim = enriched.filter(r =>
            (r.inferred_religion || "").toLowerCase() === "muslim").length;
          const hindu = enriched.filter(r =>
            (r.inferred_religion || "").toLowerCase() === "hindu").length;

          newStats.push({
            filename: file.name,
            total: enriched.length,
            deleted,
            adjudication,
            muslim,
            hindu,
            uncertain: enriched.length - muslim - hindu,
          });

          pendingFiles--;
          if (pendingFiles === 0) {
            setAllRows(prev => {
              const existingFiles = new Set(prev.map(r => r.source_file));
              const fresh = newRows.filter(r => !existingFiles.has(r.source_file));
              return [...prev, ...fresh];
            });
            setFileStats(prev => {
              const existingFiles = new Set(prev.map(s => s.filename));
              const fresh = newStats.filter(s => !existingFiles.has(s.filename));
              return [...prev, ...fresh];
            });
          }
        },
        error: () => {
          newErrors.push(`Failed to parse: ${file.name}`);
          pendingFiles--;
        }
      });
    });
    setErrors(prev => [...prev, ...newErrors]);
  }, []);

  const clearAll = () => {
    setAllRows([]); setFileStats([]);
    setErrors([]); setFilterStatus("All");
    setFilterReligion("All"); setFilterFile("All"); setSearch("");
  };

  const downloadCSV = () => {
    const csv = Papa.unparse(filteredRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = "consolidated_voter_data.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const uniqueFiles = [...new Set(allRows.map(r => r.source_file))];
  const filteredRows = allRows.filter(r => {
    if (filterStatus !== "All" && !(r.status || "").toLowerCase().includes(filterStatus.toLowerCase())) return false;
    if (filterReligion !== "All" && (r.inferred_religion || "").toLowerCase() !== filterReligion.toLowerCase()) return false;
    if (filterFile !== "All" && r.source_file !== filterFile) return false;
    if (search) {
      const s = search.toLowerCase();
      return (r.name || "").toLowerCase().includes(s) ||
        (r.epic_id || "").toLowerCase().includes(s) ||
        (r.serial_no || "").toLowerCase().includes(s);
    }
    return true;
  });

  const totalDeleted = allRows.filter(r => (r.status || "").toLowerCase().includes("delet")).length;
  const totalAdj = allRows.filter(r => (r.status || "").toLowerCase().includes("adjudicat")).length;
  const totalMuslim = allRows.filter(r => (r.inferred_religion || "").toLowerCase() === "muslim").length;
  const totalHindu = allRows.filter(r => (r.inferred_religion || "").toLowerCase() === "hindu").length;

  const cols = EXPECTED_COLUMNS;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f8f7f4",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      color: "#1f2937"
    }}>
      {/* Header */}
      <div style={{
        background: "#1c1917",
        color: "#fff",
        padding: "24px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "3px solid #d97706"
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>🗳️</span>
            <span style={{
              fontSize: 20, fontWeight: 800,
              fontFamily: "'Playfair Display', Georgia, serif",
              letterSpacing: -0.5
            }}>VoterRoll Consolidator</span>
          </div>
          <div style={{ fontSize: 12, color: "#a8a29e", marginTop: 4, letterSpacing: 0.3 }}>
            West Bengal Electoral Roll · Adjudication & Deletion Tracker
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {allRows.length > 0 && (
            <>
              <button onClick={downloadCSV} style={{
                background: "#d97706", color: "#fff",
                border: "none", borderRadius: 8,
                padding: "8px 18px", fontSize: 13,
                fontWeight: 700, cursor: "pointer"
              }}>⬇ Export CSV</button>
              <button onClick={clearAll} style={{
                background: "transparent", color: "#a8a29e",
                border: "1px solid #44403c", borderRadius: 8,
                padding: "8px 16px", fontSize: 13,
                fontWeight: 600, cursor: "pointer"
              }}>✕ Clear All</button>
            </>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "28px 24px" }}>

        {/* Upload */}
        {allRows.length === 0 ? (
          <div style={{ maxWidth: 600, margin: "60px auto" }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <h2 style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: 26, fontWeight: 800, color: "#1c1917", margin: 0
              }}>Upload Your Extracted CSVs</h2>
              <p style={{ color: "#6b7280", marginTop: 8, fontSize: 14 }}>
                Upload one or multiple CSV files exported from Claude. Data will be consolidated and summarised automatically.
              </p>
            </div>
            <DropZone onFiles={processFiles} />
            <div style={{
              marginTop: 20, background: "#fff",
              border: "1px solid #e5e7eb", borderRadius: 12, padding: 16
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Expected CSV Columns
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {EXPECTED_COLUMNS.map(col => (
                  <span key={col} style={{
                    background: "#f3f4f6", color: "#374151",
                    padding: "3px 10px", borderRadius: 6,
                    fontSize: 11, fontFamily: "monospace"
                  }}>{col}</span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Upload More Banner */}
            <div style={{
              background: "#fff", border: "1px solid #e5e7eb",
              borderRadius: 12, padding: "14px 20px",
              display: "flex", alignItems: "center",
              justifyContent: "space-between", marginBottom: 20
            }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                <strong style={{ color: "#1f2937" }}>{fileStats.length} file{fileStats.length !== 1 ? "s" : ""}</strong> loaded · <strong style={{ color: "#1f2937" }}>{allRows.length}</strong> total records
              </div>
              <label style={{
                background: "#f3f4f6", color: "#374151",
                border: "1px solid #d1d5db", borderRadius: 8,
                padding: "6px 14px", fontSize: 12,
                fontWeight: 700, cursor: "pointer"
              }}>
                + Add More CSVs
                <input type="file" accept=".csv" multiple onChange={(e) => processFiles(Array.from(e.target.files))} style={{ display: "none" }} />
              </label>
            </div>

            {/* Stat Cards */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
              <StatCard label="Total Records" value={allRows.length} color="#d97706" />
              <StatCard label="Deleted" value={totalDeleted} color="#ef4444" />
              <StatCard label="Under Adjudication" value={totalAdj} color="#f59e0b" />
              <StatCard label="Muslim" value={totalMuslim} color="#3b82f6" />
              <StatCard label="Hindu" value={totalHindu} color="#22c55e" />
              <StatCard label="PDFs Processed" value={fileStats.length} color="#8b5cf6" />
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "2px solid #e5e7eb" }}>
              {["table", "per-pdf"].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  padding: "10px 20px", fontSize: 13, fontWeight: 700,
                  background: "none", border: "none", cursor: "pointer",
                  color: activeTab === tab ? "#d97706" : "#6b7280",
                  borderBottom: activeTab === tab ? "2px solid #d97706" : "2px solid transparent",
                  marginBottom: -2, textTransform: "capitalize"
                }}>
                  {tab === "table" ? "📋 All Records" : "📁 Per-PDF Summary"}
                </button>
              ))}
            </div>

            {activeTab === "table" && (
              <>
                {/* Filters */}
                <div style={{
                  background: "#fff", border: "1px solid #e5e7eb",
                  borderRadius: 12, padding: "14px 18px",
                  display: "flex", gap: 12, flexWrap: "wrap",
                  alignItems: "center", marginBottom: 16
                }}>
                  <input
                    placeholder="🔍 Search name, EPIC, serial..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{
                      flex: 1, minWidth: 200, padding: "8px 12px",
                      border: "1px solid #d1d5db", borderRadius: 8,
                      fontSize: 13, outline: "none", fontFamily: "inherit"
                    }}
                  />
                  {[
                    { label: "Status", value: filterStatus, setter: setFilterStatus, options: ["All", "Deleted", "Adjudication"] },
                    { label: "Religion", value: filterReligion, setter: setFilterReligion, options: ["All", "Muslim", "Hindu", "Uncertain"] },
                    { label: "File", value: filterFile, setter: setFilterFile, options: ["All", ...uniqueFiles] },
                  ].map(({ label, value, setter, options }) => (
                    <select key={label}
                      value={value}
                      onChange={e => setter(e.target.value)}
                      style={{
                        padding: "8px 12px", border: "1px solid #d1d5db",
                        borderRadius: 8, fontSize: 13, background: "#fff",
                        fontFamily: "inherit", color: "#374151", cursor: "pointer"
                      }}
                    >
                      {options.map(o => <option key={o}>{o}</option>)}
                    </select>
                  ))}
                  <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 4 }}>
                    {filteredRows.length} result{filteredRows.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Table */}
                <div style={{
                  background: "#fff", border: "1px solid #e5e7eb",
                  borderRadius: 12, overflow: "hidden"
                }}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "#1c1917", color: "#fff" }}>
                          {cols.map(col => (
                            <th key={col} style={{
                              padding: "11px 14px", textAlign: "left",
                              fontWeight: 700, whiteSpace: "nowrap",
                              fontSize: 11, textTransform: "uppercase",
                              letterSpacing: 0.5, color: "#d6d3d1"
                            }}>{col.replace(/_/g, " ")}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.length === 0 ? (
                          <tr>
                            <td colSpan={cols.length} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                              No records match your filters.
                            </td>
                          </tr>
                        ) : filteredRows.map((row, i) => (
                          <tr key={i} style={{
                            background: i % 2 === 0 ? "#fff" : "#fafaf9",
                            borderBottom: "1px solid #f3f4f6"
                          }}>
                            {cols.map(col => (
                              <td key={col} style={{
                                padding: "10px 14px", color: "#374151",
                                maxWidth: col === "source_file" ? 180 : col === "name" ? 160 : 120,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                              }}>
                                {col === "status" ? (
                                  <Badge label={row[col] || "—"} type="status" />
                                ) : col === "inferred_religion" ? (
                                  <Badge label={row[col] || "—"} type="religion" />
                                ) : col === "source_file" ? (
                                  <span style={{
                                    fontSize: 11, color: "#8b5cf6",
                                    fontFamily: "monospace", fontWeight: 600
                                  }}>{row[col] || "—"}</span>
                                ) : (
                                  <span title={row[col]}>{row[col] || "—"}</span>
                                )}
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

            {activeTab === "per-pdf" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {fileStats.map((stat, i) => (
                  <div key={i} style={{
                    background: "#fff", border: "1px solid #e5e7eb",
                    borderRadius: 12, padding: "18px 22px",
                    display: "flex", alignItems: "center",
                    justifyContent: "space-between", flexWrap: "wrap", gap: 12
                  }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 700, color: "#1f2937",
                        fontFamily: "monospace"
                      }}>{stat.filename}</div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>
                        {stat.total} voter{stat.total !== 1 ? "s" : ""} flagged
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {[
                        { label: "Deleted", val: stat.deleted, color: "#ef4444", bg: "#fef2f2" },
                        { label: "Adjudication", val: stat.adjudication, color: "#d97706", bg: "#fffbeb" },
                        { label: "Muslim", val: stat.muslim, color: "#3b82f6", bg: "#eff6ff" },
                        { label: "Hindu", val: stat.hindu, color: "#16a34a", bg: "#f0fdf4" },
                        { label: "Uncertain", val: stat.uncertain, color: "#6b7280", bg: "#f9fafb" },
                      ].map(({ label, val, color, bg }) => (
                        <div key={label} style={{
                          background: bg, color: color,
                          border: `1px solid ${color}30`,
                          borderRadius: 8, padding: "6px 14px",
                          textAlign: "center", minWidth: 80
                        }}>
                          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Playfair Display', Georgia, serif" }}>{val}</div>
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => { setFilterFile(stat.filename); setActiveTab("table"); }}
                      style={{
                        background: "#f3f4f6", color: "#374151",
                        border: "1px solid #d1d5db", borderRadius: 8,
                        padding: "7px 14px", fontSize: 12,
                        fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap"
                      }}>View Records →</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {errors.length > 0 && (
          <div style={{
            marginTop: 16, background: "#fef2f2",
            border: "1px solid #fca5a5", borderRadius: 10, padding: 14
          }}>
            {errors.map((e, i) => (
              <div key={i} style={{ fontSize: 12, color: "#991b1b" }}>⚠ {e}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
