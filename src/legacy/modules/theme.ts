// @ts-nocheck
export function createThemeApi({ state, els, saveState, applyTheme }) {
  function syncThemeControls() {
    try {
      const v = (state.theme === "dark" || state.theme === "light" || state.theme === "system") ? state.theme : "system";
      // Header control
      try {
        if (els && els.themeToggle && (els.themeToggle.tagName || "").toUpperCase() === "SELECT") {
          els.themeToggle.value = v;
        }
      } catch (e) {}
      // Settings control (if present)
      try {
        const sel2 = document.getElementById("theme-select-settings");
        if (sel2 && sel2.value !== v) sel2.value = v;
      } catch (e) {}
    } catch (e) {}
  }

  function setThemePreference(pref) {
    const v = (pref === "dark" || pref === "light" || pref === "system") ? pref : "system";
    state.theme = v;
    try { saveState(); } catch (e) {}
    try { applyTheme(); } catch (e) {}
    syncThemeControls();
  }

  return { setThemePreference, syncThemeControls };
}
