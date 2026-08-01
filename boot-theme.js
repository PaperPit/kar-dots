/** Ранний boot темы до CSS/app — без inline-script (CSP script-src 'self'). */
(function () {
  var t = localStorage.getItem("kar_theme")
  if (t !== "light" && t !== "dark") {
    t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  }
  document.documentElement.dataset.theme = t
})()
