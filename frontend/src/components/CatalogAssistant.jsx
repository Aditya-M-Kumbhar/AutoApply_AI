import { useRef, useState } from "react";
import { ArrowUpRight, BookOpen, Search, Send } from "lucide-react";
import { json, request, safeLink } from "../lib/api";
import { Notice } from "./UI";

const examples = [
  "Which roles mention React and TypeScript?",
  "Find remote design roles",
  "Which listings require Python?",
];
export default function CatalogAssistant() {
  const [question, setQuestion] = useState("");
  const [useAI, setUseAI] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [asked, setAsked] = useState("");
  const input = useRef(null);
  const ask = async (event) => {
    event.preventDefault();
    if (question.trim().length < 3) return;
    setBusy(true);
    setError("");
    setResult(null);
    setAsked(question.trim());
    try {
      const response = await request(
        "/assistant/ask",
        json("POST", { question: question.trim(), useAI }),
      );
      setResult(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="assistant-layout">
      <section className="panel stack-lg">
        <div className="section-top">
          <h2>
            <BookOpen size={19} />
            Ask your job catalog
          </h2>
          <span className="soft-badge">Sources included</span>
        </div>
        <p className="muted">
          Explore skills, roles, and locations using the listings in your
          catalog. Answers can only be as complete as those listings.
        </p>
        <form className="stack" onSubmit={ask}>
          <label htmlFor="catalog-question">What would you like to know?</label>
          <textarea
            id="catalog-question"
            ref={input}
            rows={3}
            minLength={3}
            maxLength={500}
            required
            placeholder="e.g. Which remote frontend roles mention React?"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            disabled={busy}
          />
          <div className="assistant-controls">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={useAI}
                onChange={(event) => setUseAI(event.target.checked)}
                disabled={busy}
              />
              <span>Add an AI summary</span>
            </label>
            <button
              className="btn btn-primary"
              disabled={busy || question.trim().length < 3}
            >
              {busy ? "Looking through the listings…" : "Find an answer"}
              {busy ? <Search size={16} /> : <Send size={16} />}
            </button>
          </div>
          <p className="footnote">
            {useAI
              ? "Your question and retrieved listing excerpts will be sent to the configured AI provider. Your profile and resume are not included."
              : "Source search works without an AI key. Turn on the summary if you’d like the configured AI service to help explain the results."}
          </p>
        </form>
        <div className="question-examples" aria-label="Example questions">
          {examples.map((example) => (
            <button
              key={example}
              disabled={busy}
              onClick={() => {
                setQuestion(example);
                input.current?.focus();
              }}
            >
              {example}
              <ArrowUpRight size={14} />
            </button>
          ))}
        </div>
        <Notice>{error}</Notice>
      </section>
      <aside className="profile-checklist assistant-note">
        <span className="eyebrow">A LITTLE MORE CONTEXT</span>
        <h2>
          Good answers.
          <br />
          Clear sources.
        </h2>
        <p>
          We retrieve passages from your job catalog before answering. Follow
          the source links to check the original details.
        </p>
        <ul>
          <li>Ask about listed skills, locations, or responsibilities.</li>
          <li>Missing details stay missing. Check with the employer.</li>
          <li>
            AI summaries can make mistakes. Read the evidence before deciding.
          </li>
        </ul>
      </aside>
      {result && (
        <section
          className="assistant-result panel stack-lg"
          aria-label="Catalog answer"
          aria-live="polite"
        >
          <div className="section-top">
            <div>
              <span className="eyebrow">YOUR QUESTION</span>
              <h2>{asked}</h2>
            </div>
            <span className="soft-badge">
              {result.mode === "generated" ? "AI summary" : "Source search"}
            </span>
          </div>
          <p className="answer-text">{result.answer}</p>
          {result.mode === "retrieval" && useAI && !result.abstained && (
            <p className="footnote">
              An AI summary wasn’t available or didn’t pass source checks. The
              original excerpts are shown instead.
            </p>
          )}
          {result.sources?.length > 0 && (
            <div className="stack">
              <h3>Read the sources</h3>
              {result.sources.map((source) => (
                <article className="evidence-card" key={source.id}>
                  <div className="section-top">
                    <span className="source-reference">{source.id}</span>
                    <span className="muted">
                      {source.location || "Location not listed"}
                    </span>
                  </div>
                  <h3>{source.title}</h3>
                  <p className="muted">{source.company}</p>
                  <details open={result.mode === "retrieval"}>
                    <summary>Source excerpt</summary>
                    <blockquote>{source.excerpt}</blockquote>
                  </details>
                  {safeLink(source.url) && (
                    <a
                      className="inline-link"
                      href={safeLink(source.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Read original listing
                      <ArrowUpRight size={15} />
                    </a>
                  )}
                </article>
              ))}
            </div>
          )}
          {result.scope?.truncated && (
            <p className="footnote">
              This answer searches the newest{" "}
              {result.scope.candidateLimit.toLocaleString()} listings. Older
              listings are outside this search.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
