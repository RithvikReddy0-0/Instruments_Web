export function initTheme(button) {
  const saved = localStorage.getItem("instrumenthub-theme");
  if (saved === "light") document.documentElement.classList.add("light-theme");

  const sync = () => {
    const light = document.documentElement.classList.contains("light-theme");
    button.setAttribute("aria-label", light ? "Switch to dark theme" : "Switch to light theme");
  };

  button.addEventListener("click", () => {
    document.documentElement.classList.toggle("light-theme");
    localStorage.setItem("instrumenthub-theme", document.documentElement.classList.contains("light-theme") ? "light" : "dark");
    sync();
  });
  sync();
}
