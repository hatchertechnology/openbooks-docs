// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// The six component sections became three audience tracks. Every old URL still
// resolves — Astro emits a redirect page per entry on a static build, which is
// all GitHub Pages can serve.
const movedPages = {
	'/web/recording-money': '/openbooks-docs/use/recording-money/',
	'/web/reports': '/openbooks-docs/use/statements/',
	'/web/screens': '/openbooks-docs/use/screens/',
	'/web/overview': '/openbooks-docs/dev/web/',
	'/web/development': '/openbooks-docs/dev/web-development/',
	'/desktop/overview': '/openbooks-docs/use/desktop/',
	'/desktop/using-it': '/openbooks-docs/use/desktop-walkthrough/',
	'/desktop/offline': '/openbooks-docs/use/offline/',
	'/desktop/install': '/openbooks-docs/dev/desktop-build/',
	'/cli/tui': '/openbooks-docs/use/terminal/',
	'/cli/overview': '/openbooks-docs/dev/cli/',
	'/cli/commands': '/openbooks-docs/dev/cli-commands/',
	'/cli/recipes': '/openbooks-docs/dev/cli-recipes/',
	'/concepts/double-entry': '/openbooks-docs/use/double-entry/',
	'/concepts/architecture': '/openbooks-docs/dev/architecture/',
	'/concepts/money': '/openbooks-docs/dev/money/',
	'/concepts/invariants': '/openbooks-docs/dev/invariants/',
	'/api/overview': '/openbooks-docs/dev/api/',
	'/api/auth': '/openbooks-docs/dev/auth/',
	'/api/data-model': '/openbooks-docs/dev/data-model/',
	'/api/endpoints': '/openbooks-docs/dev/endpoints/',
	'/api/reports': '/openbooks-docs/dev/reports/',
	'/api/mcp': '/openbooks-docs/dev/mcp/',
};

// https://astro.build/config
export default defineConfig({
	// Deployed as a GitHub Pages project site, so it lives under a subdirectory.
	// Internal links in the content have to carry the base too — Astro doesn't
	// rewrite them in Markdown.
	site: 'https://hatchertechnology.github.io',
	base: '/openbooks-docs',
	// Third of the project's deliberately obscure dev ports, after the API's 38081
	// and the web app's 38080, so several projects can run at once. Astro's default
	// 4321 collides with every other Astro site on the machine.
	server: { port: 38082 },
	redirects: movedPages,
	vite: {
		// Astro's dev server is Vite's, so unlike Nuxt this one really does refuse
		// to drift to another port when 38082 is taken.
		server: { strictPort: true },
	},
	integrations: [
		starlight({
			title: 'OpenBooks',
			description:
				'Double-entry bookkeeping for a family or club — keep the books, print the statements, never learn what a debit is.',
			// The landing page at / is a plain Astro page outside Starlight, so the
			// two share an identity through these stylesheets rather than a layout.
			customCss: [
				'@fontsource-variable/geist/index.css',
				'@fontsource-variable/geist-mono/index.css',
				'./src/styles/tokens.css',
				'./src/styles/starlight.css',
			],
			social: [
				{
					icon: 'github',
					label: 'GitHub',
					href: 'https://github.com/hatchertechnology/openbooks',
				},
			],
			// Three audience tracks, not six components. A page lives in exactly one
			// track; the other tracks link to it rather than repeating it.
			sidebar: [
				{ label: 'Start here', items: [{ autogenerate: { directory: 'start' } }] },
				{ label: 'For treasurers', items: [{ autogenerate: { directory: 'use' } }] },
				{ label: 'Running a server', items: [{ autogenerate: { directory: 'server' } }] },
				{ label: 'For developers', items: [{ autogenerate: { directory: 'dev' } }] },
			],
		}),
	],
});
