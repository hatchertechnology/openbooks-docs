# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary reader is the **treasurer of a family or a small club** — a non-developer who
keeps the books, records money in and out, and prints statements for the monthly, quarterly,
or annual meeting. They arrive looking for how to do a specific thing in the app, not to read
about architecture.

Secondary readers, in order: a developer evaluating or running the stack locally, and the
maintainer using the site as a fast reference for routes, flags, ports, and keybindings across
five sibling repositories.

The site's current content is still weighted the other way around. It is now organized into
four audience tracks instead of six component sections — `start/`, `use/` for the treasurer,
`server/` for whoever runs the instance, and `dev/` for engineers — but the page count did not
follow the reorganisation: `dev/` holds 15 pages against `use/`'s 8, so an engineer reading
straight through still has nearly twice as much material as a treasurer. `server/`'s 6 pages
and the shared `start/` track's 3 sit outside that split. Future work should treat the remaining
imbalance as a known gap, not as the intended shape.

## Product Purpose

The published documentation site for OpenBooks (<https://hatchertechnology.github.io/openbooks-docs/>),
a double-entry bookkeeping application for a family or club. It documents five sibling
components — a Rust API, a Nuxt web app, a ratatui terminal client, a native desktop client,
and an agent plugin — each a submodule of the `openbooks` superproject.

It is judged on three things at once, in this order:

1. **Correctness.** Every route, flag, keybinding, port, and column name is read out of the
   code of the component it documents. That is the only reason the pages are worth trusting,
   and staleness is treated as worse than an absent page.
2. **A front door.** The homepage introduces the project to a first-time visitor; the section
   pages stay a dry, accurate reference.
3. **Teaching double-entry.** `use/double-entry.md` explains the ledger model from the
   beginning, for readers who are not accountants and never intend to become them, with the
   engineering half of the same story in `dev/money.md` and `dev/invariants.md`.

## Positioning

The application deliberately hides accounting vocabulary from its users — no debits, no
credits, no journal — while keeping a real double-entry ledger underneath, enforced by a
deferred constraint trigger in Postgres rather than by application code. The documentation has
to hold both halves at once: teach the reader enough of the model to trust the books, without
handing them the vocabulary the product itself refuses to show them.

## Operating Context

- Read in a browser, most often while the reader has the app open beside it.
- The reference sections are consulted mid-task, by search or by sidebar, rather than read
  front to back. `use/double-entry.md` is the exception and is read in sequence.
- Deployed as a GitHub Pages **project** site, so it is served under the `/openbooks-docs`
  base. Astro does not rewrite links inside Markdown, so internal links carry the base and a
  trailing slash themselves.
- Pushing this repository to `main` deploys it via `.github/workflows/deploy.yml`. Bumping the
  submodule pointer in the superproject does not.
- Local development: `deno task dev` on port 38082, or `just docs` from the superproject.
  `deno task build` fails on a broken link target or bad frontmatter.

## Capabilities and Constraints

- Astro 7 with the Starlight docs theme, run under Deno. Content is Markdown and MDX in
  `src/content/docs/<section>/`.
- The sidebar autogenerates per directory; a new page is a file in the right directory, ordered
  with `sidebar: { order: N }` in its frontmatter. Sidebar groups and site config live in
  `astro.config.mjs`.
- Four content directories, presented as audience tracks with sidebar labels set in
  `astro.config.mjs`: `start/` ("Start here"), `use/` ("For treasurers"), `server/` ("Running a
  server"), `dev/` ("For developers"). The agent plugin has no section of its own and is
  covered inside `dev/architecture.md`.
- The homepage (`src/pages/index.astro`) is a hand-built Astro page outside Starlight entirely,
  with its own `<head>`, its own reset and layout, and its own inline scripts. It shares an
  identity with the Starlight docs shell only through the stylesheets Starlight's `customCss`
  list loads — the self-hosted Geist fonts and `tokens.css`/`starlight.css` — not through a
  shared layout.
- Old six-section URLs (`/web/...`, `/api/...`, `/concepts/...`, and the rest) still resolve:
  `astro.config.mjs` defines a `movedPages` redirect map, and Astro emits a static redirect page
  per entry on build.
- Static output only. No backend, no database, no authenticated area.
- Terminology to keep straight: the documented product avoids accounting vocabulary in its own
  UI, so pages describing the UI should not introduce it either; pages describing the ledger
  model may and must.

## Brand Commitments

No logo, wordmark, palette, or typographic identity exists — only `public/favicon.svg` and the
site title "OpenBooks".

**Standing preference, chosen 2026-08-03:** the documentation site follows the conventions of
the open-source developer-tool docs site rather than a distinctive invented visual world. Two
world-creation rounds were offered and declined in favour of the category standard, executed at
full craft. The craft bar is set by **Stripe and Linear docs** (density, precision, tables,
near-invisible chrome), **Tailwind and Astro docs** (a generous marketing front door over a
friendly docs shell), and **Supabase and Bun** (a confident dark landing page). Convention is
the commitment here: play it straight, with no irony and no smuggled quirk, and reach that
craft level rather than substituting novelty for it.

## Evidence on Hand

- The five documented components, checked out as sibling submodules of the `openbooks`
  superproject — the authority for every factual claim on these pages.
- A deterministic sample dataset (`openbooks-api/seed.sh`, 2025 through mid-2026) covering
  every month and quarter, suitable for real screenshots of populated reports.
- No screenshots, diagrams, illustrations, or recorded demos exist in the repository today.
- No users, testimonials, adoption numbers, press, pricing, or license terms beyond the
  `LICENSE` file. None of these may be invented.

## Product Principles

1. **The code is the source, always.** A claim on a page comes from reading the component's
   source, not from what the page already said or from memory.
2. **Stale beats nothing is false here — nothing beats stale.** A missing page is a gap; a
   wrong page destroys the reason to trust any page.
3. **Write for the treasurer first.** Where a topic can be explained without engineering
   vocabulary, it is. Depth goes below the answer, not in front of it.
4. **Hide the accounting, keep the guarantee.** Explain that the books cannot go crooked
   without demanding the reader learn debits and credits to believe it.
5. **Consulted, not read.** Structure for someone who arrived mid-task with one question.

## Accessibility & Inclusion

No product-specific standard established. Starlight's defaults are the current floor.
