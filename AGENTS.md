## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## This site's content

Read `README.md` first. Content lives in `src/content/docs/<section>/`, the sidebar
autogenerates per directory, and internal links carry the `/openbooks-docs` base themselves
with a trailing slash.

Every route, flag, keybinding, port, and column name on these pages must come from the source
of the component it documents, each of which is a sibling submodule of the `openbooks`
superproject. Read the code, don't reason from what the page already says.

Anyone working in one of those submodules without this repo checked out beside it is told to
file an issue here labelled `documentation` rather than let the page go stale. Those are a
work queue:

```sh
gh issue list --label documentation
```
