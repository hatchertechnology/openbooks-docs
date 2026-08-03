# openbooks-docs

The documentation site for [OpenBooks](https://github.com/hatchertechnology/openbooks), built
with [Starlight](https://starlight.astro.build/) on Astro and run with Deno.

## Running it

From the superproject root:

```sh
just docs
```

Or from here:

```sh
deno install     # first time only
deno task dev    # http://localhost:38082/openbooks-docs
deno task build  # static output in dist/
```

## Layout

Content is Markdown and MDX under `src/content/docs/`, one directory per section:

| | |
|---|---|
| `start/` | install and run the stack |
| `concepts/` | the ledger model, money as integer cents, the invariants, the architecture |
| `api/` | the Rust API: data model, HTTP endpoints, reports, MCP tools |
| `web/` | the Nuxt web app |
| `cli/` | the CLI and terminal UI |
| `desktop/` | the native desktop client |

The sidebar autogenerates from those directories, so adding a page is a matter of dropping a
file in the right one. Order pages within a section with `sidebar: { order: N }` in the
frontmatter. Groups and site config live in `astro.config.mjs`.

## Links and the base path

The site is deployed as a GitHub Pages project site, so it's served under `/openbooks-docs`.
Astro doesn't rewrite links inside Markdown, so internal links have to carry that prefix
themselves, with a trailing slash:

```md
See [the endpoint reference](/openbooks-docs/api/endpoints/).
```

The dev server honours the same base, so a link that works locally works in production.

## Deploying

`.github/workflows/deploy.yml` builds with Deno and publishes to GitHub Pages on every push
to `main`, and can be run by hand from the Actions tab. Pages is configured with GitHub
Actions as its source, so there's no `gh-pages` branch.

Live at <https://hatchertechnology.github.io/openbooks-docs/>.

Note that this repository is a submodule of the `openbooks` superproject. Pushing to `main`
here is what triggers a deploy; bumping the submodule pointer in the superproject does not.

## Keeping it honest

These docs describe five other repositories, all submodules of the superproject. When you
change behavior in one of them, update the matching page here in the same change. Every route,
flag, keybinding, and column name on these pages is supposed to have come from the code rather
than from memory.
