# CineSafari — React + TypeScript (Vite)

This repo bootstraps CineSafari as a **React + TypeScript** app while keeping your existing legacy
DOM-driven logic running (so you can refactor incrementally).

## Quick start

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Deploy notes

- Output goes to `dist/`.
- If deploying to GitHub Pages, set `base` in `vite.config.ts` to `'/<repo-name>/'`.
- If deploying to Apache/cPanel, copy `dist/*` to your web root.
  - If you need `.htaccess`, copy `public/.htaccess` into the deployed root as well.

## Legacy code

Legacy modules live in `src/legacy/*` and are marked with `// @ts-nocheck` to keep TS strict mode happy
while you refactor.
