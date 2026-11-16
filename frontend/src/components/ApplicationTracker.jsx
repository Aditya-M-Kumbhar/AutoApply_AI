import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Calendar,
  Trash2,
} from "lucide-react";
import { json, request, safeLink } from "../lib/api";
import { EmptyState, Loading, Notice } from "./UI";
const statuses = ["Applied", "Screening", "Interviewing", "Offer", "Rejected"];
export default function ApplicationTracker({ currentUser, onNavigate }) {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(new Set());
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    request(`/applications/${currentUser.id}`, { signal: controller.signal })
      .then((result) => setApplications(result.data || []))
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [currentUser.id, retry]);
  const change = async (app, status, remove = false) => {
    if (
      remove &&
      !window.confirm(
        `Remove ${app.jobId?.title || "this application"} from your tracker?`,
      )
    )
      return;
    setPending((previous) => new Set(previous).add(app._id));
    setError("");
    try {
      const result = await request(
        `/applications/${app._id}${remove ? "" : "/status"}`,
        remove ? { method: "DELETE" } : json("PATCH", { status }),
      );
      setApplications((previous) =>
        remove
          ? previous.filter((item) => item._id !== app._id)
          : previous.map((item) => (item._id === app._id ? result.data : item)),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setPending((previous) => {
        const next = new Set(previous);
        next.delete(app._id);
        return next;
      });
    }
  };
  if (loading) return <Loading label="Opening your applications…" />;
  return (
    <div className="stack-lg">
      <Notice>{error}</Notice>
      {error && (
        <button
          className="btn btn-secondary"
          onClick={() => {
            setLoading(true);
            setError("");
            setRetry((value) => value + 1);
          }}
        >
          Reload applications
        </button>
      )}
      <div className="stats-row">
        <div>
          <span>Total applications</span>
          <strong>{applications.length}</strong>
        </div>
        <div>
          <span>In conversation</span>
          <strong>
            {
              applications.filter((app) =>
                ["Screening", "Interviewing"].includes(app.status),
              ).length
            }
          </strong>
        </div>
        <div>
          <span>Offers received</span>
          <strong>
            {applications.filter((app) => app.status === "Offer").length}
          </strong>
        </div>
      </div>
      {!applications.length ? (
        !error && (
          <EmptyState
            title="Your next chapter starts with one application."
            action="Discover jobs"
            onAction={() => onNavigate("job-feed")}
          >
            After applying for a role, choose Track on its job card. You can
            follow its progress here.
          </EmptyState>
        )
      ) : (
        <>
          <div className="section-top">
            <h2>
              <BriefcaseBusiness size={18} />
              Your application board
            </h2>
            <span className="muted">
              Update each card as things move forward.
            </span>
          </div>
          <div className="application-board">
            {statuses.map((status, index) => {
              const items = applications.filter((app) => app.status === status);
              return (
                <section
                  className={`board-column stage-${index}`}
                  key={status}
                  aria-label={status}
                >
                  <div className="board-heading">
                    <h3>
                      <span />
                      {status === "Offer" ? "Offers" : status}
                    </h3>
                    <span>{items.length}</span>
                  </div>
                  <div className="board-cards">
                    {!items.length && (
                      <p className="board-empty">Nothing here yet</p>
                    )}
                    {items.map((app) => (
                      <article className="application-card" key={app._id}>
                        <div className="section-top">
                          <span className="company-mark small">
                            {app.jobId?.company?.slice(0, 1) || "J"}
                          </span>
                          <button
                            className="icon-btn"
                            aria-label={`Remove ${app.jobId?.title || "application"}`}
                            onClick={() => change(app, null, true)}
                            disabled={pending.has(app._id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <p className="muted">
                          {app.jobId?.company || "Company unavailable"}
                        </p>
                        <h4>
                          {app.jobId?.title || "Listing no longer available"}
                        </h4>
                        <p className="application-date">
                          <Calendar size={13} />
                          {new Date(
                            app.createdAt || app.updatedAt,
                          ).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                        <label>
                          Application status
                          <select
                            value={app.status}
                            disabled={pending.has(app._id)}
                            onChange={(event) =>
                              change(app, event.target.value)
                            }
                          >
                            {statuses.map((item) => (
                              <option key={item}>{item}</option>
                            ))}
                          </select>
                        </label>
                        {safeLink(app.jobId?.applyLink) && (
                          <a
                            className="inline-link"
                            href={safeLink(app.jobId.applyLink)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View listing
                            <ArrowUpRight size={14} />
                          </a>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
