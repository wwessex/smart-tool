// @ts-nocheck
export function createWhyThisApi({ state, GENRES, moodMatchesTmdb }) {
  function genreNameById(id) {
    for (let i = 0; i < GENRES.length; i++) if (GENRES[i].id === id) return GENRES[i].name;
    return "";
  }

  function computeWhyThis(item) {
    const reasons = [];

    // Favourite genres
    try {
      const fav = Array.isArray(state.favouriteGenres) ? state.favouriteGenres : [];
      const ids = Array.isArray(item.genre_ids) ? item.genre_ids : [];
      const hits = [];
      for (let i = 0; i < ids.length; i++) {
        if (fav.indexOf(ids[i]) !== -1) {
          const n = genreNameById(ids[i]);
          if (n) hits.push(n);
        }
      }
      if (hits.length) reasons.push("Matches your favourite genres: " + hits.slice(0,3).join(", ") + (hits.length > 3 ? "…" : ""));
    } catch (e) {}

    // Mood
    try {
      if (state.mood && state.mood !== "any" && moodMatchesTmdb(item)) {
        const label = String(state.mood).replace(/(^|\s)\S/g, function(c){ return c.toUpperCase(); });
        reasons.push("Fits your Mood filter: " + label);
      }
    } catch (e) {}

    // Rating
    try {
      if (state.minRating && Number(state.minRating) > 0 && Number(item.vote_average || 0) >= Number(state.minRating)) {
        reasons.push("Meets your minimum rating (" + state.minRating + "+).");
      }
    } catch (e) {}

    // Streaming preference (high-level)
    try {
      if (state.streamingMode === "only") reasons.push("Because you prefer Streaming only.");
      else if (state.streamingMode === "first") reasons.push("Because you prefer Streaming-first results.");
    } catch (e) {}

    if (!reasons.length) reasons.push("Based on your preferences and what’s popular right now.");
    return reasons;
  }

  function showWhyThis(item) {
    try {
      // Clean any existing
      try { document.getElementById("why-this-pop")?.remove(); } catch (e) {}
      try { document.getElementById("why-this-backdrop")?.remove(); } catch (e) {}

      const backdrop = document.createElement("div");
      backdrop.id = "why-this-backdrop";
      backdrop.className = "why-this-backdrop";

      const pop = document.createElement("div");
      pop.id = "why-this-pop";
      pop.className = "why-this-pop";
      pop.setAttribute("role", "dialog");
      pop.setAttribute("aria-modal", "true");

      const title = document.createElement("div");
      title.className = "why-this-title";
      title.textContent = "Why this?";

      const body = document.createElement("div");
      body.className = "why-this-body";

      const h = document.createElement("div");
      h.className = "why-this-itemtitle";
      h.textContent = (item && (item.title || item.name)) ? (item.title || item.name) : "This pick";

      const ul = document.createElement("ul");
      ul.className = "why-this-list";
      const reasons = computeWhyThis(item);
      for (let i = 0; i < reasons.length; i++) {
        const li = document.createElement("li");
        li.textContent = reasons[i];
        ul.appendChild(li);
      }

      const close = document.createElement("button");
      close.type = "button";
      close.className = "pill-btn";
      close.textContent = "Close";

      const cleanup = function () {
        try { document.removeEventListener("keydown", onKey); } catch (e) {}
        try { backdrop.remove(); } catch (e) {}
        try { pop.remove(); } catch (e) {}
      };

      const onKey = function (ev) {
        if (ev && ev.key === "Escape") cleanup();
      };

      close.addEventListener("click", function (e) {
        try { e.stopPropagation(); } catch (e2) {}
        cleanup();
      });
      backdrop.addEventListener("click", function () { cleanup(); });
      document.addEventListener("keydown", onKey);

      body.appendChild(h);
      body.appendChild(ul);

      pop.appendChild(title);
      pop.appendChild(body);
      pop.appendChild(close);

      document.body.appendChild(backdrop);
      document.body.appendChild(pop);
    } catch (e) {}
  }

  return { computeWhyThis, showWhyThis };
}
