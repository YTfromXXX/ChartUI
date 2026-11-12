# Contributing to ChartUI

Thanks for joining. ChartUI is a Next.js app with a Python backend, plus two packages built from the same code: **chartui** (npm) and **cure-oracle** (PyPI).

## Set up

```bash
npm install
pip install -r requirements.txt -r requirements-dev.txt
npm run dev            # http://localhost:3000/menu lists every page
```

## Check before you push

```bash
npm run typecheck
python -m pytest
```

Build and try the packages:

```bash
node packages/chartui/build.mjs
pip install ".[sign]"
cure version
```

## Where things go

| You are adding… | Put it in | Notes |
|---|---|---|
| Maths, rules, parsers | `lib/<name>.ts` (and a Python twin if the backend needs it) | No React, no three.js, no `Math.random()` — take a seed. Dependency-free modules can be added to `packages/chartui/build.mjs`. |
| A LAB page | `app/lab/<name>/page.tsx` | Start from `docs/templates/lab-page/`. Link it from `app/menu/page.tsx`. |
| A design rule | `docs/design-rules.md` | Open a **New design rule** issue first. A rule needs a number and code that checks it. |
| A knot type | `lib/knotLadder.ts` | Open a **New knot** issue first. The crossing count must be checked with `lib/knotCrossings.ts`. |
| A Python module for the package | repo root, then list it in `pyproject.toml` | Keep heavy dependencies behind an extra (`[sign]`, `[api]`). |

## Design rules you cannot skip

See `docs/design-rules.md`. In short:

- No flashing above 3 Hz.
- Respect `prefers-reduced-motion`.
- Text contrast must be at least 4.5 : 1.
- Synthetic data must be labelled as synthetic.
- A game that imitates cryptography must say it is not real cryptography.

## Emoji

Emoji are welcome **in data and on screen**, but not in identifiers:

- **Yes:** data fields such as the `.meshmeta` pointers `⏸️` (start) and `▶️` (length), UI labels, docs.
- **No:** function names, variable names, file names, branch names. They are hard to search and type, and some tools mangle them.
- Save files as UTF-8. Before hashing, strings are normalised to NFC — but NFC does not add or remove U+FE0F, so `⏸` (U+23F8) and `⏸️` (U+23F8 U+FE0F) stay different. Use the exact forms listed in the `.meshmeta` `emoji` table (see `docs/meshmeta-v2.md`).
- Anyone can propose emoji in data or docs through a pull request. Maintainers review it like any other change.

## Data and money

- Prices in LABs are synthetic unless a page says otherwise.
- Nothing in this repository is investment advice. Do not add features that tell users to buy or sell.
- Never commit API keys. Use environment variables or the deployment's secret store.

## Third-party material

Draw your own diagrams. For example, do not copy Knots3D illustrations. Check the licence before adding code or data from elsewhere.

## Commits and pull requests

- Use one topic per pull request.
- Write commit messages that say what changed and why.
- Include screenshots for visual changes.
