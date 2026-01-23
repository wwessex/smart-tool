// @ts-nocheck
export function createOnboardingApi({ state, GENRES, saveState, toast, render, loadForYouRecommendations }) {
  function openOnboarding() {
    try {
      if (document.getElementById("onboarding-modal")) return;

      const wrap = document.createElement("div");
      wrap.id = "onboarding-modal";
      wrap.className = "onboarding-modal";
      wrap.setAttribute("role", "dialog");
      wrap.setAttribute("aria-modal", "true");

      const card = document.createElement("div");
      card.className = "onboarding-card";

      const h = document.createElement("div");
      h.className = "onboarding-title";
      h.textContent = "Personalise CineSafari";

      const p = document.createElement("div");
      p.className = "onboarding-copy";
      p.textContent = "Pick a few genres you love. You can change this anytime in Settings.";

      const grid = document.createElement("div");
      grid.className = "onboarding-genres";

      const selected = new Set(Array.isArray(state.favouriteGenres) ? state.favouriteGenres : []);

      for (let i = 0; i < GENRES.length; i++) {
        const g = GENRES[i];
        const lbl = document.createElement("label");
        lbl.className = "genre-chip" + (selected.has(g.id) ? " active" : "");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = String(g.id);
        cb.checked = selected.has(g.id);
        cb.addEventListener("change", function(){
          const id = Number(cb.value);
          if (cb.checked) selected.add(id);
          else selected.delete(id);
          lbl.className = "genre-chip" + (cb.checked ? " active" : "");
        });
        const sp = document.createElement("span");
        sp.textContent = g.name;
        lbl.appendChild(cb);
        lbl.appendChild(sp);
        grid.appendChild(lbl);
      }

      const streamRow = document.createElement("div");
      streamRow.className = "onboarding-row";
      const streamLbl = document.createElement("div");
      streamLbl.className = "onboarding-rowlabel";
      streamLbl.textContent = "Streaming preference";
      const streamSel = document.createElement("select");
      streamSel.className = "controls-select";
      streamSel.innerHTML = `
        <option value="any">Any</option>
        <option value="first">Streaming-first</option>
        <option value="only">Streaming only</option>
      `;
      streamSel.value = state.streamingMode || "any";
      streamRow.appendChild(streamLbl);
      streamRow.appendChild(streamSel);

      const tvRow = document.createElement("div");
      tvRow.className = "onboarding-row";
      const tvLbl = document.createElement("div");
      tvLbl.className = "onboarding-rowlabel";
      tvLbl.textContent = "Include TV shows";
      const tvToggle = document.createElement("button");
      tvToggle.type = "button";
      tvToggle.className = "pill-btn";
      tvToggle.textContent = state.includeTv ? "On" : "Off";
      tvToggle.addEventListener("click", function(){
        state.includeTv = !state.includeTv;
        tvToggle.textContent = state.includeTv ? "On" : "Off";
      });
      tvRow.appendChild(tvLbl);
      tvRow.appendChild(tvToggle);

      const note = document.createElement("div");
      note.className = "onboarding-note";
      note.textContent = "Preferences are stored on this device unless you enable sync.";

      const actions = document.createElement("div");
      actions.className = "onboarding-actions";

      const skip = document.createElement("button");
      skip.type = "button";
      skip.className = "pill-btn ghost";
      skip.textContent = "Skip for now";
      skip.addEventListener("click", function(){
        state.onboardingDone = true;
        try { saveState(); } catch (e) {}
        wrap.remove();
        try { render(); } catch (e) {}
      });

      const done = document.createElement("button");
      done.type = "button";
      done.className = "pill-btn primary";
      done.textContent = "Save preferences";
      done.addEventListener("click", function(){
        state.favouriteGenres = Array.from(selected);
        state.streamingMode = streamSel.value;
        state.onboardingDone = true;
        try { saveState(); } catch (e) {}
        wrap.remove();
        try {
          if (state.activeTab === "for-you") loadForYouRecommendations();
          else render();
        } catch (e) {}
        try { toast && toast("Preferences saved"); } catch (e) {}
      });

      actions.appendChild(skip);
      actions.appendChild(done);

      card.appendChild(h);
      card.appendChild(p);
      card.appendChild(grid);
      card.appendChild(streamRow);
      card.appendChild(tvRow);
      card.appendChild(note);
      card.appendChild(actions);

      wrap.appendChild(card);
      document.body.appendChild(wrap);

      wrap.addEventListener("click", function(ev){
        if (ev && ev.target === wrap) {
          // outside tap = skip
          state.onboardingDone = true;
          try { saveState(); } catch (e) {}
          wrap.remove();
        }
      });

    } catch (e) {}
  }

  function maybeRunOnboarding() {
    try {
      const needs = (!state.onboardingDone) || !Array.isArray(state.favouriteGenres) || state.favouriteGenres.length === 0;
      if (!needs) return;
      setTimeout(function(){ openOnboarding(); }, 250);
    } catch (e) {}
  }

  return { openOnboarding, maybeRunOnboarding };
}
