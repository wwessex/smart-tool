// @ts-nocheck
export function createFiltersDrawerApi({ document, body }) {
  function openFiltersDrawer() {
    try { body.classList.add("filters-open"); } catch (e) {}
    try {
      const bd = document.getElementById("filters-backdrop");
      if (bd) bd.classList.remove("hidden");
    } catch (e) {}
  }

  function closeFiltersDrawer() {
    try { body.classList.remove("filters-open"); } catch (e) {}
    try {
      const bd = document.getElementById("filters-backdrop");
      if (bd) bd.classList.add("hidden");
    } catch (e) {}
  }

  function toggleFiltersDrawer() {
    try {
      if (body.classList.contains("filters-open")) closeFiltersDrawer();
      else openFiltersDrawer();
    } catch (e) {}
  }

  return { openFiltersDrawer, closeFiltersDrawer, toggleFiltersDrawer };
}
