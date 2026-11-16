import { useEffect, useState } from "react";
import { ArrowUpRight, BarChart3, Layers, TrendingUp } from "lucide-react";
import { request } from "../lib/api";
import { EmptyState, Loading, Notice } from "./UI";
export default function MarketDashboard() {
  const [data, setData] = useState({ skills: [], roles: [], sources: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all(
      ["trending-skills", "trending-roles", "source-breakdown"].map((path) =>
        request(`/market/${path}`, { signal: controller.signal }),
      ),
    )
      .then(([skills, roles, sources]) =>
        setData({
          skills: skills.data || [],
          roles: roles.data || [],
          sources: sources.data || [],
        }),
      )
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retry]);
  if (loading) return <Loading label="Bringing the market into focus…" />;
  const total = data.sources.reduce((sum, source) => sum + source.count, 0);
  return (
    <div className="stack-lg">
      <Notice>{error}</Notice>
      {error ? (
        <button
          className="btn btn-secondary"
          onClick={() => {
            setLoading(true);
            setError("");
            setRetry((value) => value + 1);
          }}
        >
          Try again
        </button>
      ) : !total ? (
        <EmptyState title="Insights grow with your catalog.">
          Once job listings are added, you’ll see which roles and skills appear
          most often.
        </EmptyState>
      ) : (
        <>
          <div className="stats-row">
            <div>
              <span>Jobs in your catalog</span>
              <strong>{total.toLocaleString()}</strong>
            </div>
            <div>
              <span>Skills represented in this view</span>
              <strong>{data.skills.length}</strong>
            </div>
            <div>
              <span>Job sources</span>
              <strong>{data.sources.length}</strong>
            </div>
          </div>
          <div className="insights-grid">
            {[
              [
                "Skills in demand",
                data.skills,
                TrendingUp,
                "How often each skill appears across your catalog.",
              ],
              [
                "Roles on the radar",
                data.roles,
                BarChart3,
                "The most common job titles in your catalog.",
              ],
            ].map(([title, rows, Icon, description]) => {
              const max = Math.max(1, ...rows.map((row) => row.count));
              return (
                <section className="panel insight-panel" key={title}>
                  <div className="section-top">
                    <h2>
                      <Icon size={19} />
                      {title}
                    </h2>
                    <ArrowUpRight size={17} className="muted" />
                  </div>
                  <p className="muted">{description}</p>
                  {!rows.length ? (
                    <p className="muted">No data available yet.</p>
                  ) : (
                    <ol className="bar-list" aria-label={title}>
                      {rows.slice(0, 8).map((row, index) => (
                        <li key={row._id}>
                          <div className="bar-label">
                            <span>
                              <small>
                                {String(index + 1).padStart(2, "0")}
                              </small>
                              {row._id || "Unspecified"}
                            </span>
                            <strong>
                              {row.count}
                              <span className="sr-only"> listings</span>
                            </strong>
                          </div>
                          <div className="bar-track" aria-hidden="true">
                            <span
                              style={{ width: `${(row.count / max) * 100}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              );
            })}
          </div>
          <section className="panel stack">
            <div className="section-top">
              <h2>
                <Layers size={18} />
                Where opportunities come from
              </h2>
              <span className="soft-badge">{data.sources.length} sources</span>
            </div>
            <div className="source-grid">
              {data.sources.map((source, index) => (
                <div className="source-item" key={source._id}>
                  <span className={`source-dot source-${index % 4}`} />
                  <div>
                    <strong>{source._id || "Other"}</strong>
                    <span>{source.count.toLocaleString()} listings</span>
                  </div>
                  <span>{Math.round((source.count / total) * 100)}%</span>
                </div>
              ))}
            </div>
          </section>
          <p className="footnote">
            Based on your current catalog, not the entire job market. Counts may
            be cached for up to six hours.
          </p>
        </>
      )}
    </div>
  );
}
