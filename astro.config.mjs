// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

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
	vite: {
		// Astro's dev server is Vite's, so unlike Nuxt this one really does refuse
		// to drift to another port when 38082 is taken.
		server: { strictPort: true },
	},
	integrations: [
		starlight({
			title: 'OpenBooks',
			description:
				'Double-entry bookkeeping for a family or club — API, web app, CLI, and desktop client.',
			social: [
				{
					icon: 'github',
					label: 'GitHub',
					href: 'https://github.com/hatchertechnology/openbooks',
				},
			],
			sidebar: [
				{ label: 'Start here', items: [{ autogenerate: { directory: 'start' } }] },
				{ label: 'Concepts', items: [{ autogenerate: { directory: 'concepts' } }] },
				{ label: 'API', items: [{ autogenerate: { directory: 'api' } }] },
				{ label: 'Web app', items: [{ autogenerate: { directory: 'web' } }] },
				{ label: 'CLI & TUI', items: [{ autogenerate: { directory: 'cli' } }] },
				{ label: 'Desktop', items: [{ autogenerate: { directory: 'desktop' } }] },
			],
		}),
	],
});
