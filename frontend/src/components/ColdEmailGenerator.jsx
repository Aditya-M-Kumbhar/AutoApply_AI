import { useEffect, useRef, useState } from "react";
import { Check, Copy, FilePenLine, Mail, WandSparkles } from "lucide-react";
import { json, request } from "../lib/api";
import { EmptyState, Loading, Notice } from "./UI";
export default function ColdEmailGenerator({ currentUser, onNavigate }) {
  const [apps, setApps] = useState([]);
  const [selected, setSelected] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [tone, setTone] = useState("Professional");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [retry, setRetry] = useState(0);
  const timer = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    request(`/applications/${currentUser.id}`, { signal: controller.signal })
      .then((result) => {
        const available = (result.data || []).filter((app) => app.jobId?._id);
        setApps(available);
        setSelected(available[0]?._id || "");
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [currentUser.id, retry]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const generate = async () => {
    const jobId = apps.find((app) => app._id === selected)?.jobId?._id;
    if (!jobId) return;
    setBusy("generate");
    setError("");
    setCopied(false);
    try {
      const result = await request("/email/generate", json("POST", { jobId }));
      setSubject(result.data.subject || "");
      setBody(result.data.body || "");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };
  const personalize = async () => {
    setBusy("personalize");
    setError("");
    setCopied(false);
    try {
      const result = await request(
        "/email/personalize",
        json("POST", { emailBody: body, toneInstruction: tone }),
      );
      setBody(result.data.body || body);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(
        "Clipboard access isn’t available. Select and copy the draft directly.",
      );
    }
  };
  if (loading) return <Loading label="Loading your tracked opportunities…" />;
  return (
    <div className="stack-lg">
      <Notice>{error}</Notice>
      {error && !apps.length && (
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
      )}
      {!apps.length ? (
        !error && (
          <EmptyState
            title="A good introduction starts with an opportunity."
            action="Find a job to track"
            onAction={() => onNavigate("job-feed")}
          >
            Track a job first, then come back to create a personal outreach
            message for that role.
          </EmptyState>
        )
      ) : (
        <div className="outreach-layout">
          <aside className="panel stack-lg">
            <span className="eyebrow">01 / THE OPPORTUNITY</span>
            <div>
              <h2>Who’s on your radar?</h2>
              <p className="muted">
                Choose a role to build your first draft around.
              </p>
            </div>
            <label>
              Tracked opportunity
              <select
                value={selected}
                disabled={!!busy}
                onChange={(event) => {
                  if (
                    body &&
                    !window.confirm("Switch jobs and clear this draft?")
                  )
                    return;
                  setSelected(event.target.value);
                  setBody("");
                  setSubject("");
                  setCopied(false);
                }}
              >
                {apps.map((app) => (
                  <option key={app._id} value={app._id}>
                    {app.jobId.company} — {app.jobId.title}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="btn btn-primary"
              disabled={!!busy}
              onClick={generate}
            >
              <FilePenLine size={17} />
              {busy === "generate"
                ? "Creating draft…"
                : body
                  ? "Create a new draft"
                  : "Create draft"}
            </button>
            <div className="outreach-tone stack">
              <span className="eyebrow">02 / YOUR VOICE</span>
              <label>
                Writing tone
                <select
                  value={tone}
                  disabled={!!busy}
                  onChange={(event) => setTone(event.target.value)}
                >
                  {[
                    "Professional",
                    "Casual",
                    "Enthusiastic",
                    "Bold",
                    "Short",
                  ].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <button
                className="btn btn-secondary"
                disabled={!body.trim() || !!busy}
                onClick={personalize}
              >
                <WandSparkles size={16} />
                {busy === "personalize"
                  ? "Refining your message…"
                  : "Refine with AI"}
              </button>
              <p className="footnote">
                AI refinement needs a configured AI service. Your draft remains
                editable either way.
              </p>
            </div>
          </aside>
          <section className="panel email-editor">
            <div className="section-top">
              <h2>
                <Mail size={18} />
                Your introduction
              </h2>
              <span className="soft-badge">Draft · Not sent</span>
            </div>
            <label>
              Subject
              <input
                value={subject}
                disabled={!!busy}
                onChange={(event) => {
                  setSubject(event.target.value);
                  setCopied(false);
                }}
                placeholder="A thoughtful subject line goes here"
              />
            </label>
            <label className="email-body-label">
              Message
              <textarea
                aria-label="Message"
                value={body}
                disabled={!!busy}
                onChange={(event) => {
                  setBody(event.target.value);
                  setCopied(false);
                }}
                placeholder="Create a draft to get started, or write your own introduction here. Keep it personal, specific, and brief."
              />
            </label>
            <div className="form-footer">
              <span>Review the details. Add your own voice.</span>
              <button
                className="btn btn-primary"
                disabled={!body.trim() || !!busy}
                onClick={copy}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? "Copied to clipboard" : "Copy draft"}
              </button>
            </div>
            <p className="footnote" role="status">
              {copied
                ? "Your draft is ready to paste into your email app."
                : "Nothing is sent from here. Copy your draft into the email app you use."}
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
