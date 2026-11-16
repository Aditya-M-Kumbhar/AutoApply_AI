import { useEffect, useState } from "react";

const key = "autoapplyai:theme";
function preference() {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export default function ThemeToggle() {
  const [theme, setTheme] = useState(
    () =>
      document.documentElement.dataset.theme ||
      (preference() === "dark"
        ? "dark"
        : preference() === "light"
          ? "light"
          : window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"),
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#141d19" : "#285442");
  }, [theme]);
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const followSystem = (event) => {
      if (!["light", "dark"].includes(preference()))
        setTheme(event.matches ? "dark" : "light");
    };
    query.addEventListener("change", followSystem);
    return () => query.removeEventListener("change", followSystem);
  }, []);
  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    try {
      localStorage.setItem(key, next);
    } catch {
      /* The current session still supports switching. */
    }
    setTheme(next);
  };
  return (
    <button
      type="button"
      className="theme-toggle"
      role="switch"
      aria-label="Night mode"
      aria-checked={theme === "dark"}
      title={theme === "light" ? "Switch to night mode" : "Switch to day mode"}
      onClick={toggle}
      data-mode={theme}
    >
      <span className="theme-scene" aria-hidden="true">
        <span className="theme-stars">
          <i />
          <i />
          <i />
        </span>
        <span className="theme-sun" />
        <span className="theme-moon">
          <i />
          <i />
        </span>
        <span className="theme-cloud" />
        <span className="theme-horizon" />
      </span>
      <span className="theme-label">{theme === "light" ? "Day" : "Night"}</span>
    </button>
  );
}
