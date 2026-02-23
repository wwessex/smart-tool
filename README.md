# smart-tool

Smart Tool is a TypeScript-first toolkit that provides [short summary of primary purpose — e.g., a collection of utilities, CLI helpers, or domain-specific tooling]. It aims to be small, well-tested, and easy to integrate into TypeScript projects.

- Primary language: TypeScript (≈96% of the codebase)
- Additional files: HTML, CSS, and a small amount of JavaScript

## Features

- Core utilities for [describe main feature area, e.g., "data transformation", "project scaffolding", "API client helpers"]
- Small, modular functions with strong TypeScript types
- CLI entrypoint (if applicable) for common workflows
- Well-structured tests and build pipeline
- Extensible configuration and plugin-friendly design

> Replace the bracketed phrases above with project-specific descriptions if you want the README to reflect exact functionality.

## Installation

Install from npm:

```bash
npm install --save smart-tool
# or
yarn add smart-tool
```

If this repository is intended to be used locally or as a dev tool, install dev dependencies and build:

```bash
git clone https://github.com/wwessex/smart-tool.git
cd smart-tool
npm install
npm run build
```


## Local Translation Model Provisioning

Lengua Materna translation runs against local files in `public/models/` when operating in offline/local-only mode.

```bash
npm run fetch-models
```

This command provisions:
- `public/models/smart-planner-150m-q4/` (local planner model)
- `public/models/<translation-model-id>/` for all translation models in `browser-translation/src/models/registry.ts`

Shipped translation model IDs:
`opus-mt-ar-en`, `opus-mt-bn-en`, `opus-mt-cy-en`, `opus-mt-de-en`, `opus-mt-en-ar`, `opus-mt-en-bn`, `opus-mt-en-cy`, `opus-mt-en-de`, `opus-mt-en-es`, `opus-mt-en-fr`, `opus-mt-en-hi`, `opus-mt-en-it`, `opus-mt-en-pa`, `opus-mt-en-pl`, `opus-mt-en-ps`, `opus-mt-en-pt`, `opus-mt-en-so`, `opus-mt-en-ti`, `opus-mt-en-ur`, `opus-mt-es-en`, `opus-mt-fr-en`, `opus-mt-hi-en`, `opus-mt-it-en`, `opus-mt-pa-en`, `opus-mt-pl-en`, `opus-mt-ps-en`, `opus-mt-pt-en`, `opus-mt-so-en`, `opus-mt-ti-en`, `opus-mt-ur-en`.

Validate that every `MODEL_REGISTRY` entry has required local artifacts:

```bash
npm run validate:translation-models
LOCAL_ONLY_MODELS=1 npm run validate:translation-models:offline
```

Required per-model file layout is documented in `browser-translation/README.md`.

### Translation environment variables

The translation hook (`src/hooks/useTranslation.ts`) supports these Vite env vars:

- `VITE_ALLOW_REMOTE_TRANSLATION_MODELS`
  - `"true"` enables remote model fallback.
  - `"false"` disables remote model fallback.
  - If unset, remote model fallback defaults to disabled in production builds and enabled in non-production/test contexts.
- `VITE_HF_TOKEN` (optional)
  - If set, requests for remote translation models include `Authorization: Bearer <token>`.
- `VITE_REMOTE_MODEL_BASE_PATH` (optional)
  - Overrides the remote model host/base path used by the translation engine.

Example:

```bash
VITE_ALLOW_REMOTE_TRANSLATION_MODELS=true
VITE_HF_TOKEN=hf_xxx
VITE_REMOTE_MODEL_BASE_PATH=https://huggingface.co
```

> Security note: Vite `VITE_*` variables are exposed to browser clients. Do not use sensitive long-lived/private tokens unless you explicitly accept the risk of browser exposure.

> Put real tokens in local-only env files (for example `.env.local`) and never commit them to git.

## Quick start / Usage

Example (importing from TypeScript):

```ts
import { exampleFunction } from 'smart-tool';

const result = exampleFunction({ /* options */ });
console.log(result);
```

If the project exposes a CLI:

```bash
npx smart-tool command --option value
# or after building locally
node ./dist/cli.js command --option value
```

Include a short, copy-pastable example showing the most common use-case for your users.

## Configuration

smart-tool supports configuration via:
- config file (e.g., `smarttool.config.{ts,js,json}`)
- environment variables (prefix SMART_TOOL_)
- programmatic API (pass an options object to the initializer)

Example config snippet:

```js
// smarttool.config.js
module.exports = {
  optionA: true,
  apiKey: process.env.SMART_TOOL_API_KEY,
};
```

## Development

Scripts (add or adjust to match package.json):

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Run linter
npm run lint

# Run typecheck
npm run typecheck
```

Suggested package.json scripts (if not already present):

```json
{
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest",
    "lint": "eslint . --ext .ts,.tsx",
    "typecheck": "tsc --noEmit"
  }
}
```

Adjust test runner and linters to match the repository's current setup (Jest, Vitest, ESLint, etc.).

## Contributing

Contributions are welcome!

- Open an issue describing the problem or feature
- Fork the repo and create a feature branch
- Run tests and linters before submitting a PR
- Follow the existing code style and TypeScript conventions
- Provide tests for new features and bug fixes

Suggested branch / PR workflow:
1. Create a branch: `git checkout -b feat/short-description`
2. Make changes, run tests: `npm test`
3. Open a PR with a clear description and link any related issues

## Testing & CI

- The repository is TypeScript-first; ensure changes pass `npm run typecheck`.
- Tests should run in CI (GitHub Actions suggested). Example GitHub Actions job:
  - install Node
  - install dependencies
  - run typecheck, lint, build, and tests

If you want, I can draft a GitHub Actions workflow file for this repo.

## API / Reference

Add a short API reference here or link to a docs folder. Example:

- `exampleFunction(options)` — do X, returns Y
- `anotherUtility(input)` — does Z

## License

Specify the license (e.g., MIT). Example:

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## Maintainers / Contact

Maintainer: wwessex

For questions or help, open an issue or contact the maintainer via GitHub.

## Roadmap / TODO

- Document public API in more detail
- Add more examples and recipes in `/docs`
- Improve test coverage for edge cases
- (Replace with your project-specific roadmap items)

## Acknowledgements

Mention libraries, inspirations, or contributors.
