(() => {
  let saved;
  try {
    saved = localStorage.getItem("autoapplyai:theme");
  } catch {
    /* Storage is optional. */
  }
  const theme =
    saved === "light" || saved === "dark"
      ? saved
      : matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content =
    theme === "dark" ? "#141d19" : "#285442";
})();
