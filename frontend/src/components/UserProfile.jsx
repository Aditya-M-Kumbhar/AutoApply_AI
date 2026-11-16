import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  FileText,
  Plus,
  Save,
  Upload,
  X,
} from "lucide-react";
import { json, request } from "../lib/api";
import { Notice } from "./UI";
export default function UserProfile({ currentUser, onProfileUpdated }) {
  const contact = currentUser.profileVault?.contactDetails || {};
  const [form, setForm] = useState({
    name: currentUser.name || "",
    email: currentUser.email || "",
    phone: contact.phone || "",
    linkedin: contact.linkedin || "",
    github: contact.github || "",
    website: contact.website || "",
  });
  const [skills, setSkills] = useState(currentUser.skills || []);
  const [skillInput, setSkillInput] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [resumePath, setResumePath] = useState(
    currentUser.profileVault?.resumePath || "",
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [learning, setLearning] = useState([]);
  const [learningError, setLearningError] = useState("");
  const [loadingPaths, setLoadingPaths] = useState(false);
  const fileInput = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    if (skillInput.trim().length < 2) return;
    const timer = setTimeout(
      () =>
        request(
          `/profile/skill-autocomplete?prefix=${encodeURIComponent(skillInput.trim())}`,
          { signal: controller.signal },
        )
          .then((data) => setSuggestions(Array.isArray(data) ? data : []))
          .catch(() => setSuggestions([])),
      250,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [skillInput]);
  const addSkill = (value) => {
    const clean = value.trim();
    if (!clean) return;
    setSkills((previous) =>
      previous.some((skill) => skill.toLowerCase() === clean.toLowerCase())
        ? previous
        : [...previous, clean],
    );
    setSkillInput("");
    setSuggestions([]);
  };
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) =>
        data.append(key, value.trim()),
      );
      data.append("skills", JSON.stringify(skills));
      const result = await request("/auth/profile", {
        method: "PUT",
        body: data,
      });
      onProfileUpdated(result.data.user);
      setNotice({
        success: true,
        text: "Your profile is saved. Your next search will use these skills.",
      });
    } catch (error) {
      setNotice({ text: error.message });
    } finally {
      setSaving(false);
    }
  };
  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (
      !file.name.toLowerCase().endsWith(".pdf") ||
      file.size > 10 * 1024 * 1024
    ) {
      setNotice({ text: "Please choose a PDF smaller than 10 MB." });
      event.target.value = "";
      return;
    }
    setUploading(true);
    setNotice(null);
    try {
      const data = new FormData();
      data.append("resume", file);
      const result = await request("/profile/parse-resume", {
        method: "POST",
        body: data,
      });
      const merged = [...new Set([...skills, ...(result.data.skills || [])])];
      setSkills(merged);
      setResumePath(result.data.resumePath || "");
      setNotice({
        success: true,
        text: "Resume uploaded. Review your extracted skills, then save your profile.",
      });
      // Keep unsaved contact fields local while exposing the saved resume to the workspace.
      onProfileUpdated({
        profileVault: {
          ...currentUser.profileVault,
          resumePath: result.data.resumePath,
          skills: result.data.skills,
        },
        skills: result.data.skills,
      });
    } catch (error) {
      setNotice({ text: error.message });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };
  const findLearning = async () => {
    setLoadingPaths(true);
    setLearningError("");
    try {
      const apps =
        (await request(`/applications/${currentUser.id}`)).data || [];
      const paths = await Promise.all(
        apps
          .filter((app) => app.jobId?.skillsRequired?.length)
          .map(async (app) => ({
            id: app._id,
            title: app.jobId.title,
            company: app.jobId.company,
            ...(await request(
              "/profile/learning-path",
              json("POST", {
                targetSkills: app.jobId.skillsRequired,
                userSkills: skills,
              }),
            )),
          })),
      );
      setLearning(paths);
      if (!paths.length)
        setLearningError(
          "Track a job with listed skills to see what you could learn next.",
        );
    } catch (error) {
      setLearningError(error.message);
    } finally {
      setLoadingPaths(false);
    }
  };
  const bind = (key) => ({
    value: form[key],
    onChange: (event) =>
      setForm((previous) => ({ ...previous, [key]: event.target.value })),
  });
  const completed = [
    Boolean(form.name.trim()),
    Boolean(skills.length),
    Boolean(resumePath),
  ].filter(Boolean).length;
  return (
    <div className="profile-layout">
      <form className="panel stack-lg" onSubmit={save}>
        <div className="section-top">
          <div>
            <span className="eyebrow">THE BASICS</span>
            <h2>Nice to meet you.</h2>
          </div>
          <span className="soft-badge">Your personal profile</span>
        </div>
        <Notice success={notice?.success}>{notice?.text}</Notice>
        <div className="form-grid">
          <label>
            Full name
            <input required autoComplete="name" {...bind("name")} />
          </label>
          <label>
            Email address
            <input
              type="email"
              required
              autoComplete="email"
              {...bind("email")}
            />
          </label>
          <label>
            Phone <span className="optional">(optional)</span>
            <input
              type="tel"
              autoComplete="tel"
              placeholder="Your phone number"
              {...bind("phone")}
            />
          </label>
          <label>
            LinkedIn <span className="optional">(optional)</span>
            <input
              type="url"
              placeholder="https://linkedin.com/in/you"
              {...bind("linkedin")}
            />
          </label>
          <label>
            GitHub <span className="optional">(optional)</span>
            <input
              type="url"
              placeholder="https://github.com/you"
              {...bind("github")}
            />
          </label>
          <label>
            Portfolio <span className="optional">(optional)</span>
            <input
              type="url"
              placeholder="https://yourwebsite.com"
              {...bind("website")}
            />
          </label>
        </div>
        <section className="stack">
          <div>
            <h3>What are you good at?</h3>
            <p className="muted">
              Add skills you’d like to use in your next role. These help
              calculate your job matches.
            </p>
          </div>
          <label htmlFor="skill-input">Add a skill</label>
          <div className="skill-entry">
            <input
              id="skill-input"
              value={skillInput}
              onChange={(event) => {
                setSkillInput(event.target.value);
                setSuggestions([]);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  addSkill(skillInput);
                }
                if (event.key === "Escape") setSuggestions([]);
              }}
              placeholder="e.g. React, project management"
              autoComplete="off"
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => addSkill(skillInput)}
              disabled={!skillInput.trim()}
            >
              <Plus size={17} />
              Add
            </button>
          </div>
          {suggestions.length > 0 && (
            <div className="suggestion-list" aria-label="Suggested skills">
              {suggestions.slice(0, 6).map((skill) => (
                <button
                  type="button"
                  key={skill}
                  onClick={() => addSkill(skill)}
                >
                  {skill}
                  <Plus size={14} />
                </button>
              ))}
            </div>
          )}
          <div className="skill-tags profile-skills">
            {skills.length ? (
              skills.map((skill) => (
                <span key={skill}>
                  {skill}
                  <button
                    type="button"
                    aria-label={`Remove ${skill}`}
                    onClick={() =>
                      setSkills((previous) =>
                        previous.filter((item) => item !== skill),
                      )
                    }
                  >
                    <X size={13} />
                  </button>
                </span>
              ))
            ) : (
              <p className="muted">Your skills will appear here.</p>
            )}
          </div>
        </section>
        <section className="stack">
          <h3>Your resume</h3>
          <p className="muted">
            Upload a PDF to extract skills automatically. You can always add
            skills by hand.
          </p>
          <div className="upload-zone">
            <Upload size={25} strokeWidth={1.5} />
            <div>
              <strong>
                {uploading
                  ? "Reading your resume…"
                  : "Bring your experience along."}
              </strong>
              <p>PDF only · Up to 10 MB</p>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,application/pdf"
              id="resume-file"
              onChange={upload}
              disabled={uploading || saving}
              className="file-input"
            />
            <label
              className={`btn btn-secondary ${uploading || saving ? "disabled" : ""}`}
              htmlFor="resume-file"
            >
              {uploading ? "Uploading…" : "Choose PDF"}
            </label>
          </div>
          {resumePath && (
            <p className="resume-name">
              <FileText size={15} />
              {resumePath.split(/[\\/]/).pop()}
              <Check size={15} />
            </p>
          )}
        </section>
        <div className="form-footer">
          <span>Make it yours. Keep it up to date.</span>
          <button className="btn btn-primary" disabled={saving || uploading}>
            <Save size={16} />
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>
      <aside className="stack-lg">
        <section className="profile-checklist">
          <span className="eyebrow">A STRONGER START</span>
          <h2>
            A little more you.
            <br />A better fit.
          </h2>
          <p>
            Your profile helps turn a broad job search into something more
            personal.
          </p>
          <div className="progress-track">
            <span style={{ width: `${(completed / 3) * 100}%` }} />
          </div>
          <span className="muted">{completed} of 3 essentials added</span>
          {[
            [Boolean(form.name.trim()), "Add your name"],
            [Boolean(skills.length), "List your skills"],
            [Boolean(resumePath), "Upload a resume"],
          ].map(([done, text]) => (
            <div className="checklist-item" key={text}>
              <span className={done ? "check-done" : ""}>
                {done && <Check size={13} />}
              </span>
              {text}
            </div>
          ))}
        </section>
        <section className="panel learning-panel">
          <BookOpen size={25} />
          <h3>Room to grow.</h3>
          <p className="muted">
            Compare your skills with the roles you’re tracking and find your
            next learning steps.
          </p>
          <button
            className="inline-link"
            type="button"
            onClick={findLearning}
            disabled={loadingPaths}
          >
            {loadingPaths
              ? "Finding learning paths…"
              : "Explore learning paths"}
            <ArrowRight size={16} />
          </button>
          {learningError && (
            <p role="status" className="muted">
              {learningError}
            </p>
          )}
          {learning.map((path) => (
            <div className="learning-path" key={path.id}>
              <strong>{path.title}</strong>
              <span className="muted">{path.company}</span>
              <div className="skill-tags">
                {path.missingSkills?.length ? (
                  path.missingSkills.map((skill) => (
                    <span key={skill}>{skill}</span>
                  ))
                ) : (
                  <span>All listed skills covered</span>
                )}
              </div>
            </div>
          ))}
        </section>
      </aside>
    </div>
  );
}
