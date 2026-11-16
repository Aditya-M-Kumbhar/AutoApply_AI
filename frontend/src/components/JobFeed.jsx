import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  MapPin,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { json, request, safeLink } from "../lib/api";
import { EmptyState, Loading, Notice, Pagination } from "./UI";
const initialFilters = {
  search: "",
  location: "",
  sourcePlatform: "",
  minScore: "",
  sort: "recommended",
};
export default function JobFeed({ currentUser, onNavigate }) {
  const [filters, setFilters] = useState(initialFilters);
  const [query, setQuery] = useState({ ...initialFilters, page: 1 });
  const [jobs, setJobs] = useState([]);
  const [pagination, setPagination] = useState({ pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [tracked, setTracked] = useState(new Set());
  const [pending, setPending] = useState(new Set());
  const [retry, setRetry] = useState(0);
  const [retrieval, setRetrieval] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    request(`/jobs?${new URLSearchParams(query)}`, {
      signal: controller.signal,
    })
      .then((result) => {
        setJobs(result.data.jobs || []);
        setPagination(result.data.pagination || { pages: 1, total: 0 });
        setRetrieval(result.data.retrieval || null);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, retry]);
  useEffect(() => {
    const controller = new AbortController();
    request(`/applications/${currentUser.id}`, { signal: controller.signal })
      .then((result) =>
        setTracked(
          new Set(
            (result.data || [])
              .map((app) =>
                typeof app.jobId === "string" ? app.jobId : app.jobId?._id,
              )
              .filter(Boolean),
          ),
        ),
      )
      .catch((err) => {
        if (err.name !== "AbortError")
          setActionError(`Tracked jobs couldn’t be loaded. ${err.message}`);
      });
    return () => controller.abort();
  }, [currentUser.id]);
  const track = async (id) => {
    setPending((previous) => new Set(previous).add(id));
    setActionError("");
    try {
      await request(
        "/applications",
        json("POST", { jobId: id, status: "Applied" }),
      );
      setTracked((previous) => new Set(previous).add(id));
    } catch (err) {
      setActionError(err.message);
    } finally {
      setPending((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
    }
  };
  const startQuery = (next) => {
    setLoading(true);
    setError("");
    setQuery(next);
  };
  const reset = () => {
    setFilters(initialFilters);
    startQuery({ ...initialFilters, page: 1 });
  };
  const field = (key) => ({
    value: filters[key],
    onChange: (event) =>
      setFilters((previous) => ({ ...previous, [key]: event.target.value })),
  });
  return (
    <div className="stack-lg">
      {!currentUser.skills?.length && (
        <section className="profile-prompt">
          <span className="prompt-icon">
            <BriefcaseBusiness size={23} />
          </span>
          <div>
            <strong>A better match starts with you.</strong>
            <p>Add a few skills to get more meaningful job match scores.</p>
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => onNavigate("profile")}
          >
            Add my skills
            <ArrowRight size={16} />
          </button>
        </section>
      )}
      <form
        className="panel search-panel"
        onSubmit={(event) => {
          event.preventDefault();
          startQuery({ ...filters, page: 1 });
        }}
      >
        <div className="section-top">
          <h2>
            <SlidersHorizontal size={17} />
            Make your search your own
          </h2>
          <button type="button" className="text-btn" onClick={reset}>
            Clear filters
          </button>
        </div>
        <div className="search-fields">
          <label className="search-wide">
            Role or company
            <div className="input-icon">
              <Search size={17} />
              <input placeholder="e.g. Product designer" {...field("search")} />
            </div>
          </label>
          <label>
            Location
            <div className="input-icon">
              <MapPin size={17} />
              <input placeholder="City or remote" {...field("location")} />
            </div>
          </label>
          <button className="btn btn-primary">
            <Search size={17} />
            Find jobs
          </button>
        </div>
        <div className="filter-row">
          <label>
            Source
            <select {...field("sourcePlatform")}>
              <option value="">All sources</option>
              {[
                "Adzuna",
                "Remotive",
                "The Muse",
                "Public Scrape",
                "LinkedIn",
                "Naukri",
                "Wellfound",
                "Greenhouse",
                "Workday",
                "Custom Scrape",
              ].map((source) => (
                <option key={source}>{source}</option>
              ))}
            </select>
          </label>
          <label>
            Match score
            <select {...field("minScore")}>
              <option value="">Any match</option>
              <option value="70">70% and above</option>
              <option value="40">40% and above</option>
            </select>
          </label>
          <span className="filter-hint">A little focus goes a long way.</span>
        </div>
      </form>
      <div className="results-heading">
        <div>
          <h2>
            Opportunities for you
            <span className="count-badge">
              {loading ? "…" : pagination.total}
            </span>
          </h2>
          <p>
            {query.sort === "newest"
              ? "Newest listings first."
              : query.search
                ? "Ranked by search relevance, skill overlap, and recency."
                : "Recommended using your listed skills and job recency."}
          </p>
        </div>
        <span className="results-note">
          Your next chapter could be here
          <ArrowUpRight size={15} />
        </span>
      </div>
      <Notice>{actionError}</Notice>
      <label className="sort-control">
        Sort results
        <select
          {...field("sort")}
          onChange={(event) => {
            setFilters((previous) => ({
              ...previous,
              sort: event.target.value,
            }));
            startQuery({ ...query, sort: event.target.value, page: 1 });
          }}
        >
          <option value="recommended">Recommended</option>
          <option value="newest">Newest first</option>
        </select>
      </label>
      {retrieval?.truncated && (
        <p className="footnote">
          Searching the newest {retrieval.candidateLimit.toLocaleString()}{" "}
          listings. Older listings are outside this search.
        </p>
      )}
      {loading ? (
        <Loading label="Finding your opportunities…" />
      ) : error ? (
        <div className="panel stack">
          <Notice>{error}</Notice>
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
        </div>
      ) : !jobs.length ? (
        <EmptyState
          title="A fresh search might help."
          action="Clear filters"
          onAction={reset}
        >
          Try a broader role or a different location. If your catalog is new, an
          admin needs to add job listings first.
        </EmptyState>
      ) : (
        <div className="job-grid">
          {jobs.map((job) => {
            const score = Math.round(Number(job.fitScore) || 0);
            const link = safeLink(job.applyLink);
            return (
              <article className="job-card" key={job._id}>
                <div className="job-card-top">
                  <span className="company-mark">
                    {job.company?.slice(0, 1).toUpperCase() || "J"}
                  </span>
                  <span
                    className={`match-badge ${score >= 70 ? "match-strong" : ""}`}
                  >
                    {currentUser.skills?.length
                      ? `${score}% skill match`
                      : "Add skills for a match"}
                  </span>
                </div>
                <div className="job-title">
                  <p>{job.company || "Company not listed"}</p>
                  <h3>{job.title}</h3>
                  <span>
                    <MapPin size={14} />
                    {job.location || "Location not listed"}
                  </span>
                </div>
                <p className="job-description">
                  {job.description ||
                    "Open the job listing to learn more about this opportunity."}
                </p>
                <div className="skill-tags">
                  {job.skillsRequired?.slice(0, 4).map((skill) => (
                    <span key={skill}>{skill}</span>
                  ))}
                  {job.skillsRequired?.length > 4 && (
                    <span title={job.skillsRequired.slice(4).join(", ")}>
                      +{job.skillsRequired.length - 4} skills
                    </span>
                  )}
                </div>
                {job.matchExplanation && (
                  <details className="match-details">
                    <summary>Why this match?</summary>
                    {job.matchExplanation.hasProfile ? (
                      <div>
                        <p>
                          <strong>Skills in common:</strong>{" "}
                          {job.matchExplanation.matchedSkills.join(", ") ||
                            "No listed overlap yet."}
                        </p>
                        {job.matchExplanation.missingSkills.length > 0 && (
                          <p>
                            <strong>Not on your profile:</strong>{" "}
                            {job.matchExplanation.missingSkills.join(", ")}
                          </p>
                        )}
                        <p>
                          {job.matchExplanation.basis === "listed-requirements"
                            ? "Score is the share of listed requirements covered by your skills."
                            : "No explicit skill list was available, so the score uses skill mentions in the description."}{" "}
                          It is not a prediction of being hired.
                        </p>
                      </div>
                    ) : (
                      <p>Add your skills to see a personal explanation.</p>
                    )}
                  </details>
                )}
                <div className="job-source">
                  <span>{job.sourcePlatform || "Job listing"}</span>
                  <span>
                    {job.postedAt && !Number.isNaN(Date.parse(job.postedAt))
                      ? new Date(job.postedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })
                      : "Date unavailable"}
                  </span>
                </div>
                <div className="job-actions">
                  <button
                    className={`btn ${tracked.has(job._id) ? "btn-tracked" : "btn-secondary"}`}
                    disabled={tracked.has(job._id) || pending.has(job._id)}
                    onClick={() => track(job._id)}
                  >
                    {tracked.has(job._id) ? (
                      <Check size={16} />
                    ) : (
                      <Plus size={16} />
                    )}
                    {tracked.has(job._id)
                      ? "Tracked"
                      : pending.has(job._id)
                        ? "Saving…"
                        : "Track application"}
                  </button>
                  {link ? (
                    <a
                      className="btn btn-primary"
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Apply for ${job.title} (opens in a new tab)`}
                    >
                      Apply
                      <ArrowUpRight size={16} />
                    </a>
                  ) : (
                    <span className="unavailable-link">Link unavailable</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      <Pagination
        page={pagination.page || query.page}
        pages={pagination.pages}
        onChange={(page) => startQuery({ ...query, page })}
      />
      <p className="footnote">
        Applying opens the original listing. Tracking keeps it organized here;
        it doesn’t submit an application.
      </p>
    </div>
  );
}
