// Auto-generated from legacy index.html <body>.
// Script tags stripped to avoid double-running legacy boot.
export const SHELL_HTML = `<div class="app">
<header class="topbar">
<button aria-label="Go to For You" class="brand brand-home" id="brand-home" type="button">
<div aria-hidden="true" class="brand-mark">
<div class="brand-mark-inner"></div>
<span class="beta-badge" aria-hidden="true">BETA</span>
</div>
<div class="brand-text">CineSafari</div>
</button>
<div class="topbar-actions">
<button type="button" class="user-chip" id="user-chip" aria-label="Account">
  <img id="user-chip-avatar" alt="" />
  <span id="user-chip-name"></span>
</button>

<div class="status-pill" id="status-pill" role="status" aria-live="polite">Local</div>

<button aria-label="Menu" class="theme-toggle burger-btn" id="menu-toggle" type="button">
          ☰
        </button>
<button aria-label="Settings" class="theme-toggle" id="settings-toggle" type="button">
          ⚙︎
        </button>
<select class="theme-toggle" id="theme-toggle" aria-label="Theme">
          <option value="system">System</option>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
</div>
</header>
<nav class="tabs">
<button class="tab-btn active" data-tab="for-you">For You</button>
<button class="tab-btn" data-tab="discover">Discover</button>
<button class="tab-btn" data-tab="radar">Radar</button>
<button class="tab-btn" data-tab="watchlist">Watchlist</button>
<button class="tab-btn" data-tab="watched">Watched</button>
<button class="tab-btn" data-tab="rewatch">Rewatch</button>
<button class="tab-btn" data-tab="lists">Lists</button>
<button class="tab-btn" data-tab="social">Social</button>
<button class="tab-btn" data-tab="account">Account</button>
</nav>
<main><div class="pagehead" id="pagehead"><section class="section-header">
<h1 class="section-title" id="section-title">For You</h1>
<p class="section-subtitle" id="section-subtitle">
          Smart suggestions based on your favourite genres.
        </p>
</section><form autocomplete="off" class="search-form" id="search-form">
<div class="search-wrapper">
<span class="search-icon">🔍</span>
<input class="search-input" id="search-input" placeholder="Search within your recommendations…" type="search"/>
<div class="search-suggest hidden" id="search-suggest" role="listbox" aria-label="Search suggestions"></div>
</div>
</form><div class="controls-bar" id="controls-bar">
<button class="filters-toggle" id="filters-toggle" type="button" aria-haspopup="dialog" aria-controls="filters-drawer">Filters</button>
<div class="filters-backdrop hidden" id="filters-backdrop" aria-hidden="true"></div>
<div class="controls-group" id="filters-drawer">
<label class="controls-label">
<span>Sort by</span>
<select class="controls-select" id="sort-select">
<option value="relevance" selected>Relevance</option>
<option value="default">Default</option>
<option value="title-asc">Title (A–Z)</option>
<option value="year-desc">Year (newest)</option>
<option value="rating-desc">Rating (highest)</option>
<option value="popularity-desc">Popularity</option>
<option value="priority">Priority (watchlist)</option>
</select>
</label>
<label class="controls-label">
<span>Min rating</span>
<select class="controls-select" id="rating-filter-select">
<option value="0">Any</option>
<option value="5">5.0+</option>
<option value="7">7.0+</option>
<option value="8">8.0+</option>
</select>
</label>
<label class="controls-label">
<span>Mood</span>
<select class="controls-select" id="mood-select">
<option value="any">Any</option>
<option value="cosy">Cosy</option>
<option value="gory">Gory</option>
<option value="mindbendy">Mind-bendy</option>
<option value="feelgood">Feel-good</option>
<option value="darkhumour">Dark humour</option>
</select>
</label>
<label class="controls-label">
<span>Streaming</span>
<select class="controls-select" id="streaming-select">
<option value="any">Any</option>
<option value="first">Streaming-first</option>
<option value="only">Streaming only</option>
</select>
</label>
</div>
<div class="list-actions" id="list-actions"></div>
</div><div class="message" id="message">
        Pick favourite genres in Settings for personalised recommendations — otherwise we’ll show popular films.
      </div></div>




<div class="settings-panel" id="settings-panel"></div>
<div class="settings-panel" id="lists-panel"></div>
<div class="settings-panel" id="account-panel"></div>
<div class="settings-panel" id="social-panel"></div>
<input accept="application/json" class="file-input-hidden" id="import-input" type="file"/>
<div class="grid" id="card-grid"></div>
<div class="debug" id="debug"></div>
</main>
</div>
<!-- Bottom navigation (mobile-first) -->
<nav class="bottom-nav" id="bottom-nav" aria-label="Bottom navigation">
  <button class="bottom-nav-btn" type="button" data-tab="for-you" aria-label="For You">
    <span class="bn-icon" aria-hidden="true">🏠</span>
    <span class="bn-label">For You</span>
  </button>
  <button class="bottom-nav-btn" type="button" data-tab="discover" aria-label="Discover">
    <span class="bn-icon" aria-hidden="true">🔭</span>
    <span class="bn-label">Discover</span>
  </button>
  <button class="bottom-nav-btn" type="button" data-tab="watchlist" aria-label="Watchlist">
    <span class="bn-icon" aria-hidden="true">📌</span>
    <span class="bn-label">Watchlist</span>
  </button>
  <button class="bottom-nav-btn" type="button" data-tab="lists" aria-label="Lists">
    <span class="bn-icon" aria-hidden="true">🗂️</span>
    <span class="bn-label">Lists</span>
  </button>
  <button class="bottom-nav-btn" type="button" data-tab="account" aria-label="Account">
    <span class="bn-icon" aria-hidden="true">👤</span>
    <span class="bn-label">Account</span>
  </button>
</nav>
<!-- Detail overlay -->
<div aria-hidden="true" class="detail-overlay hidden" id="detail-overlay">
  <div aria-modal="true" class="detail-panel" role="dialog">
    <div class="detail-hero" id="detail-hero">
      <div class="detail-hero-inner">
        <div class="detail-title-block">
          <div class="detail-title" id="detail-title"></div>
          <div class="detail-meta" id="detail-meta"></div>
        </div>
        <button aria-label="Close" class="detail-close" id="detail-close" type="button">×</button>
      </div>
    </div>

    <div class="detail-tabs" id="detail-tabs" role="tablist" aria-label="Title sections">
      <button class="detail-tab-btn active" type="button" data-detailtab="overview" role="tab" aria-selected="true">Overview</button>
      <button class="detail-tab-btn" type="button" data-detailtab="cast" role="tab" aria-selected="false">Cast</button>
      <button class="detail-tab-btn" type="button" data-detailtab="watch" role="tab" aria-selected="false">Where to watch</button>
      <button class="detail-tab-btn" type="button" data-detailtab="similar" role="tab" aria-selected="false">Similar</button>
      <button class="detail-tab-btn" type="button" data-detailtab="organise" role="tab" aria-selected="false">Organise</button>
    </div>

    <div class="detail-scroll" id="detail-scroll">
      <section class="detail-section active" data-detailsection="overview" role="tabpanel">
        <div class="detail-body">
          <div class="detail-poster" id="detail-poster"></div>
          <div class="detail-main">
            <div class="detail-overview" id="detail-overview"></div>
            <div class="detail-chips" id="detail-chips"></div>
            <div id="detail-links"></div>
          </div>
        </div>
      </section>

      <section class="detail-section" data-detailsection="cast" role="tabpanel">
        <div class="detail-section-title">Top cast</div>
        <div class="cast-rail" id="detail-cast"></div>
      </section>

      <section class="detail-section" data-detailsection="watch" role="tabpanel">
        <div class="detail-section-title">Where to watch</div>
        <div class="detail-watch" id="detail-watch"></div>
      </section>

      <section class="detail-section" data-detailsection="similar" role="tabpanel">
        <div class="detail-section-title">More like this</div>
        <div class="detail-rail" id="detail-similar"></div>
      </section>

      <section class="detail-section" data-detailsection="organise" role="tabpanel">
        <div class="detail-section-title">Your stuff</div>
        <div class="detail-actions" id="detail-actions"></div>
      </section>
    </div>

    <div class="detail-sticky" id="detail-sticky">
      <button class="pill-btn" id="detail-sticky-watchlist" type="button">+ Watchlist</button>
      <button class="pill-btn" id="detail-sticky-watched" type="button">✓ Watched</button>
      <button class="pill-btn" id="detail-sticky-rate" type="button">★ Rate</button>
      <button class="pill-btn" id="detail-sticky-notes" type="button">✎ Notes</button>
    </div>
  </div>
</div>
<!-- Burger menu overlay (mobile) -->
<div aria-hidden="true" class="menu-overlay hidden" id="menu-overlay">
<div aria-label="Navigation menu" aria-modal="true" class="menu-panel" role="dialog">
<div class="menu-header">
<div class="menu-title">Menu</div>
<button aria-label="Close menu" class="detail-close" id="menu-close" type="button">×</button>
</div>
<div class="menu-items">
<button class="menu-item" data-tab="for-you" type="button">For You</button>
<button class="menu-item" data-tab="discover" type="button">Discover</button>
<button class="menu-item" data-tab="radar" type="button">Radar</button>
<button class="menu-item" data-tab="watchlist" type="button">Watchlist</button>
<button class="menu-item" data-tab="watched" type="button">Watched</button>
<button class="menu-item" data-tab="rewatch" type="button">Rewatch</button>
<button class="menu-item" data-tab="lists" type="button">Lists</button>
<button class="menu-item" data-tab="social" type="button">Social</button>
<button class="menu-item" data-tab="account" type="button">Account</button>
<button class="menu-item" data-tab="settings" type="button">Settings</button>
</div>
<div class="menu-section" id="menu-pinned-section" style="display:none">
  <div class="menu-subtitle">Pinned lists</div>
  <div class="menu-pinned-items" id="menu-pinned-items"></div>
</div>
</div>
</div>

<div aria-atomic="true" aria-live="polite" id="toast-host"></div>`;
