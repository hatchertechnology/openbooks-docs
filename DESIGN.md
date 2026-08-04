---
name: OpenBooks Docs
description: The published documentation site for OpenBooks, a double-entry bookkeeping app for a family or club.
colors:
  bg: "#ffffff"
  bg-subtle: "#f7f8f8"
  bg-sunken: "#f0f2f2"
  bg-inset: "#14181b"
  border: "#e2e5e7"
  border-strong: "#cbd0d3"
  text: "#14181b"
  text-2: "#4a5257"
  text-3: "#697178"
  accent: "#0b7a5b"
  accent-hover: "#096349"
  accent-text: "#08624a"
  accent-soft: "#e6f4ef"
  accent-contrast: "#ffffff"
  bg-dark: "#0b0d0e"
  bg-subtle-dark: "#14181a"
  bg-sunken-dark: "#101314"
  bg-inset-dark: "#050708"
  border-dark: "#23282b"
  border-strong-dark: "#343b3f"
  text-dark: "#eceff1"
  text-2-dark: "#a9b2b7"
  text-3-dark: "#838d93"
  accent-dark: "#3ecf9a"
  accent-hover-dark: "#5fdcac"
  accent-text-dark: "#4fd9a6"
  accent-soft-dark: "#10231d"
  accent-contrast-dark: "#04211a"
typography:
  display:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 4.6vw, 3.75rem)"
    fontWeight: 620
    lineHeight: 1.15
    letterSpacing: "-0.032em"
  headline:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 2.8vw, 2.25rem)"
    fontWeight: 620
    lineHeight: 1.15
    letterSpacing: "-0.022em"
  title:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 620
    lineHeight: 1.15
    letterSpacing: "-0.022em"
  body:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 560
    letterSpacing: "0.03em"
  mono:
    fontFamily: "Geist Mono Variable, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "0.875em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
spacing:
  1: "0.25rem"
  2: "0.5rem"
  3: "0.75rem"
  4: "1rem"
  5: "1.5rem"
  6: "2rem"
  7: "3rem"
  8: "4rem"
  9: "6rem"
  10: "8rem"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-contrast}"
    rounded: "{rounded.md}"
    padding: "0 1.5rem"
    height: "2.75rem"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "0 1.5rem"
    height: "2.75rem"
  button-secondary-hover:
    backgroundColor: "{colors.bg-subtle}"
---

# Design System: OpenBooks Docs

## Overview

**Creative North Star: "The Category Standard"**

This is a deliberate commitment to convention. Two rounds of invented visual worlds were
offered against this codebase and both were declined in favor of executing the ordinary
open-source developer-tool docs site as well as it can be executed. The craft bar named for
that decision was Stripe and Linear docs (density, precision, tables, chrome that gets out of
the way), Tailwind and Astro docs (a generous marketing front door sitting over a plain,
friendly docs shell), and Supabase and Bun (a confident dark landing page). Nothing here is
trying to look unlike a docs site; the ambition is entirely in the execution: hairline rules
that land exactly, a type scale that never overreaches, one accent used sparingly, and real
product screenshots instead of placeholders.

The system holds two surfaces to one identity: a hand-built Astro landing page at `/`, outside
Starlight entirely, and the Starlight docs shell for every content page. `tokens.css` is the
only thing binding them. Neither surface forks a Starlight component, and the landing page
carries its own reset and layout rather than reusing Starlight's. A shared `localStorage` key
(`starlight-theme`) keeps light/dark in agreement across the boundary, and an inline
before-paint script on the landing page reads it so there is no flash of the wrong theme.

**Key Characteristics:**
- One accent color (jade), used narrowly: primary buttons, links, active/highlighted figures.
- A cool neutral ramp carries almost everything else, text, borders, backgrounds, shadows.
- Self-hosted variable fonts (Geist, Geist Mono) for text and figures; no external font requests.
- Hairline 1px borders and flat surfaces; no gradients, no illustration, no iconography beyond a
  handful of inline stroke SVGs (nav mark, theme toggle, GitHub mark, chevrons).
- Exactly one authored motion moment on the entire site (see Do's and Don'ts).
- Light is the declared default theme, on the stated reasoning that these pages are as likely
  read at a desk in daylight as at night.

## Colors

A cool neutral ramp, near-white through near-black, with blue-gray undertones rather than true
gray, plus a single jade accent that is the one deliberate nod to a columnar ledger pad.

### Primary
- **Jade** (`#0b7a5b` light / `#3ecf9a` dark): the only saturated color in the system. Used for
  primary CTA backgrounds, link text and its underline, the nav brand mark, and the accent ring
  on focus. Its dark-mode value is notably brighter and more saturated than a simple
  lightness-only palette swap: dark mode needed more punch against a near-black background to
  stay legible and roughly equally prominent.

### Neutral
- **Text** (`#14181b` light / `#eceff1` dark): headings and highest-emphasis text (button
  labels, table cell values, the total row in the sample ledger).
- **Text, secondary** (`#4a5257` light / `#a9b2b7` dark): the default body copy color; almost
  every paragraph on the landing page sits here rather than at full-emphasis text.
- **Text, tertiary** (`#697178` light / `#838d93` dark): captions, table headers, figure labels,
  footer copy, the quietest readable tier.
- **Background** (`#ffffff` light / `#0b0d0e` dark): the page surface.
- **Background, subtle** (`#f7f8f8` light / `#14181a` dark): the sample-transaction slip, the
  footer band, hover backgrounds on secondary buttons, the padding frame around product shots.
- **Background, sunken** (`#f0f2f2` light / `#101314` dark): declared in `tokens.css` but not
  referenced by any selector in `landing.css` or `starlight.css`, see Open decisions.
- **Background, inset** (`#14181b` light / `#050708` dark): the dark panel used for code blocks
  and captured terminal output on the landing page, regardless of the surrounding theme, these
  panels are always dark, styled to look like a terminal rather than like the page around them.
- **Border** (`#e2e5e7` light / `#23282b` dark): the default hairline, section dividers, card
  edges, table row dividers, input/frame borders.
- **Border, strong** (`#cbd0d3` light / `#343b3f` dark): button borders at rest, the proof
  section's step dividers, table header rule.

### Named Rules
**The One Accent Rule.** Jade is the only saturated color on either surface. It marks exactly
one thing per view: the primary action, the active link, the total in a worked ledger example.
Nothing else recruits it for decoration.

**The Always-Dark Panel Rule.** Code and terminal panels (`.code`, `.term`) render on the
dark-inset background in both site themes, and their border is a fixed dark hex (`#23282b`)
rather than the theme-following `--ob-border` token. They are photographs of a terminal, not
themed UI, and neither their fill nor their border flips with the page. The border was tokenized
originally; a fixed dark value replaced it because the theme-following border drew a bright halo
around the deliberately-dark panel in light mode.

## Typography

**Display Font:** Geist Variable (with `ui-sans-serif, system-ui, sans-serif` fallback)
**Body Font:** Geist Variable (same family, no separate body face)
**Label/Mono Font:** Geist Mono Variable (with `ui-monospace, SF Mono, Menlo, monospace`
fallback)

Both are self-hosted via Fontsource (`@fontsource-variable/geist`,
`@fontsource-variable/geist-mono`), imported identically on the landing page and inside
Starlight's `customCss`, so no font request depends on which surface loaded first.

**Character:** A single, restrained grotesk carries the whole site; the mono face is reserved
for code, captured terminal output, and, pointedly, for money and other figures, so amounts
read with the fixed-width alignment a ledger needs even outside a code block
(`font-variant-numeric: tabular-nums` is set on `body` and reused wherever a number appears).

### Hierarchy
- **Display** (weight 620, `clamp(2.25rem, 4.6vw, 3.75rem)`, line-height 1.15): the landing
  page `<h1>` only, negative letter-spacing (`-0.032em`), capped at `22ch` so it never becomes a
  full-width headline.
- **Headline** (weight 620, `clamp(1.75rem, 2.8vw, 2.25rem)`, line-height 1.15): landing-page
  section `<h2>`s (`.section__head h2`, `.install__text h2`) and Starlight `<h2>` at a fixed
  `1.75rem`.
- **Title** (weight 620, `1.375rem`): `<h3>` on the landing page (proof steps, client
  rows, track cards) and Starlight `<h3>` at the same size.
- **Body** (weight 400, `1rem`, line-height 1.65): default paragraph text, `--ob-text-2` colored,
  max measure `68ch` where a block of prose needs a cap (`.honest`, `.section__head`).
- **Label** (weight 560, `0.75rem`, letter-spacing `0.03em`, uppercase): figure captions
  (`.figures dt`), table column headers, and the `ERROR` tag in the proof section.

### Named Rules
**The Tighter-At-Scale Rule.** Two tracking values exist, `-0.022em` for most headings,
`-0.032em` ("tighter") reserved for the single largest size on the page, the hero `<h1>`. Scale
and tightness move together.

## Layout

A single `max-width: 1200px` container (`--ob-container`), centered with `margin-inline: auto`
and `1.5rem` inline padding, shared by the nav, every `.section`, the hero, and the footer.
There is no second, narrower container variant. Section rhythm is vertical only: each
`.section` stacks with a top hairline border and top/bottom padding, no side-by-side page
columns beyond the two-up grids inside individual sections (hero, client rows, install).

Spacing is one linear scale from `0.25rem` to `8rem` (`--ob-space-1` through `--ob-space-10`),
used for both padding and the gaps in flex/grid layouts, no separate "component padding" scale.

Prose measure is capped at `68ch` (`--ob-measure`) for section intros and the "Where it stands"
copy; individual card/blurb text uses ad hoc `ch` caps (44–46ch) rather than the shared token,
so the measure token is honored loosely, not universally.

The hero's off-grid image frame (`.hero__frame`) bleeds past the container's right edge so the
screenshot reads as a window onto the app rather than a card sitting in a column. Its
`margin-right` is `min(0px, calc(var(--ob-container) / 2 - var(--ob-space-5) - 50vw))`, measured
against the `1200px` container, never against the grid column the frame itself sits in. An
earlier version measured it as `calc(50% - 50vw)`, which resolved that `50%` against the hero
grid's second column instead of the container and overshot the viewport by 243–305px, putting a
horizontal scrollbar on the front page at every width above `60rem` — verified in Chrome at
961/1024/1280/1440/1800px, before and after. `html` also carries `overflow-x: clip` (`clip`
rather than `hidden`, so `.nav` keeps its sticky positioning) as a backstop: the bleed is
measured in `vw`, which counts the classic scrollbar the client area doesn't have, so it can
still overshoot by a few px even against the correct base, and the root is where that overflow
is actually reported.

**Responsive behavior** (rendered and inspected at every listed breakpoint, see Open decisions):
two breakpoints, both max-width, both mobile-first-in-reverse (desktop is the base case):
- `60rem`: two-column grids (hero, client rows, install) collapse to one column; the hero's
  bleeding image frame is reset with a plain `margin-right: 0` in this media block rather than
  relying on the bleed formula to zero itself out; reversed client rows un-reverse their DOM
  order and drop the wide-terminal ratio below; section vertical padding steps down one size
  (`--ob-space-8` to `--ob-space-7`).
- `46rem`: the nav's inline link list is hidden and its `.nav__menu` disclosure takes over (see
  Navigation); the figure strip's gap tightens; captured terminal type shrinks further to
  `0.58rem`.

Reversed client rows (`.client--reverse`, the two that hold a terminal pane) invert their column
ratio as well as their DOM order above `60rem`: `1.2fr / 0.8fr` instead of the forward rows'
`0.85fr / 1.15fr`, so the pane gets the wider half. The reasoning is legibility, not composition:
an 80-column capture is only evidence if its numbers are readable, and the narrower half wasn't
enough room for that.

Starlight's own content column is set to `50rem` (`--sl-content-width`), independent of the
landing page's `1200px` container, the two surfaces do not share a page-width value, only the
token layer that colors and types them.

### Named Rules
**The Media-Queries-Last Rule.** Every top-level `@media` block in `landing.css` sits at the end
of the file, under a comment saying they must stay last. Plain rules come first, in source order.
This is a scar, not a preference: twice during this build an appended fix at equal specificity
silently defeated a narrow-viewport rule because it landed later in the file than the media
block that was supposed to win, first for `.section`/`.hero`/`.client`/`.term` padding, then for
the mobile nav, which was invisible at every width until its media rule was moved after the
disclosure markup it targeted. Appending a fix to this file without checking where the media
blocks sit is how both bugs happened.

**The Container-Not-Column Bleed Rule.** Anything that bleeds past the container edge is
measured against the container (`--ob-container`), never against a grid column, and `html`
clips (`overflow-x: clip`) so a `vw` rounding overshoot can never become a page-level
scrollbar. This is a third scar alongside the Media-Queries-Last Rule, not a new preference:
the hero frame's bleed formula shipped broken, measuring against the wrong base and putting a
horizontal scrollbar on the page at every width above `60rem` until it was caught.

## Elevation & Depth

Flat by default, hairline borders doing the separating work that shadows would do elsewhere.
Shadows exist as a three-step scale (`--ob-shadow-sm` / `--ob-shadow` / `--ob-shadow-lg`) but are
applied narrowly and consistently: framed product screenshots and inset code/terminal panels,
never plain content cards, buttons at rest, or nav/section chrome. The three steps differ mostly
in spread and opacity, not hue; dark mode's shadow values use plain black at higher opacity
rather than a tinted shadow.

### Shadow Vocabulary
- **`--ob-shadow-sm`** (`0 1px 2px rgba(20,24,27,.06), 0 1px 3px rgba(20,24,27,.05)` light):
  the primary button's resting shadow, the smallest lift, on the one element meant to look
  most clickable.
- **`--ob-shadow`** (`0 2px 4px rgba(20,24,27,.05), 0 6px 16px rgba(20,24,27,.07)` light): the
  default frame shadow for secondary product shots (`.client__frame .shot`), the install code
  block, and interactive track cards on hover.
- **`--ob-shadow-lg`** (`0 4px 8px rgba(20,24,27,.05), 0 16px 40px rgba(20,24,27,.1)` light): the
  hero product shot only, the single largest, most prominent image on the page.

### Named Rules
**The Frame-Not-Card Rule.** Shadows exist to make a screenshot read as a photograph of the
product floating over the page, not to give ordinary content containers (cards, buttons, panels)
a raised feel. A plain content card gets a border; only a product frame gets a shadow.

## Shapes

Four-step radius scale, `4px` / `8px` / `12px` / `16px` (`--ob-radius-sm` / `--ob-radius` /
`--ob-radius-lg` / `--ob-radius-xl`), assigned by element size rather than by role: small
controls and inline code use `4px`, most bordered containers (buttons, code/terminal panels,
inline nav controls) use the base `8px`, and the largest surfaces, product-shot frames and
track cards, step up to `12px`. `--ob-radius-xl` (`16px`) is declared in `tokens.css` but not
referenced anywhere in `landing.css` or `starlight.css`, see Open decisions.

Borders are uniformly `1px` solid, drawn from the border/border-strong pair; nothing uses a
thicker or dashed border except the proof section's step dividers, which use a `2px` top border
specifically to read as a stronger sequence marker than an ordinary hairline.

## Components

### Buttons
- **Shape:** `8px` radius (`--ob-radius`), `2.75rem` fixed height, horizontal padding at
  `--ob-space-5` (`1.5rem`).
- **Primary (`.btn--primary`):** jade background, contrast text color, `--ob-shadow-sm` at
  rest; hover darkens to `--ob-accent-hover` on both background and border.
- **Secondary (`.btn`):** transparent/page background, `1px` border in `--ob-border-strong`,
  text-colored label; hover swaps background to `--ob-bg-subtle` and darkens the border to
  `--ob-text-3`. No ghost or tertiary variant exists, only these two.
- **Transitions:** background, border-color, and transform all animate on the shared
  `--ob-ease` curve (`cubic-bezier(0.22, 1, 0.36, 1)`) at `0.15s`.

### Cards / Containers
- **Track cards** (`.track`, the three audience-track links): `12px` radius, `1px` border,
  `2rem` internal padding (`--ob-space-6`); hover lifts `2px` (`translateY(-2px)`), adds
  `--ob-shadow`, and darkens the border, the only content card in the system with a hover
  elevation change.
- **Sample-ledger slip** (`.slip`): `8px` radius, `1px` border, `--ob-bg-subtle` fill, no shadow.
  It's a data card, not a product frame, so it stays flat per the Frame-Not-Card rule.
- **Product-shot frame** (`.shot`): a matting panel around every screenshot, `--ob-bg-subtle`
  fill, `12px` radius, `--ob-space-2` inner padding, with the image itself inset a further `4px`
  radius inside it. Added specifically because the captured app screenshots are photographed
  light-themed and stood out as bare white slabs on a dark page; matting them makes every shot
  read as a framed photograph regardless of site theme. Hero and client frames layer
  `--ob-shadow-lg` / `--ob-shadow` respectively on top of this same `.shot` base. That layering
  is a chain of three equal-specificity rules (`.shot`, then `.hero__frame .shot`, then
  `.client__frame .shot`) declared in that order in `landing.css`; which shadow wins is decided
  by source order, not by which selector reads more specific, so reordering that block silently
  changes which frame's shadow shows. It was deliberately left unmerged during a later
  consolidation pass for exactly that reason — a live trap for the next contributor who touches
  that file.
- **Hero image candidates:** the hero `<Image>` declares `sizes="(max-width: 60rem) 92vw, 50vw"`
  with `widths` up to `2200` (the source PNG's intrinsic width, `2200×1560`), so the browser can
  pick a candidate that actually matches the frame's rendered width. An earlier `46rem` value
  understated the real slot — measured at 603–1063 CSS px above the `60rem` breakpoint — and made
  the browser fetch a candidate too small for the box, so the site's most prominent image
  rendered soft.

### Inset Code / Terminal Panels
- **Style:** `--ob-bg-inset` background, a fixed `#23282b` border regardless of theme (see the
  Always-Dark Panel Rule), `8px` radius, Geist Mono at `0.78rem`. Captured terminal panes
  (`.client__frame--term .term`) share that `0.78rem` at rest and step down to `0.58rem` at the
  `46rem` breakpoint; the in-proof code panel (`.proof .code`) runs smaller still, `0.66rem`, so
  its quoted trigger fits the column. The `0.78rem` / `1.5` rest-state pair on
  `.client__frame--term .term` is now the only declaration of that size: the original rule had set
  `0.62rem` / line-height `1.45`, and the appended fix that followed it at equal specificity
  overrode both, so the original pair never applied at any viewport. That dead pair has been
  deleted and the winning values now sit in a single rule.
- **Accessibility:** the captured 80×24 terminal pane (`.term` inside `.client__frame--term`)
  carries `role="img"` and a descriptive `aria-label` summarizing what the dashboard shows,
  because a screen reader would otherwise read every box-drawing glyph in the capture aloud. The
  second terminal pane — the `curl`/MCP JSON transcript — deliberately does not get this
  treatment: it is genuine readable content (a request and a real JSON response), not a
  screenshot standing in for one, so it should be read as text rather than announced as an image.
- **The proof panel is now one unit.** `.proof__artifact` wraps the code block and the error line
  beneath it (`.code` + `.proof__err`) in a flex column and carries the `margin-top: auto` that
  used to sit on `.code` alone, so all three proof columns still share a bottom baseline with the
  code panel and its error line moving together.
- **Scrolling:** `overflow-x: auto` with a custom thin dark scrollbar (`#3a4247`) so the OS
  default light scrollbar doesn't cut across the dark panel.
- **Wrapping:** every inset panel now sets `white-space: pre` and scrolls instead of wrapping,
  including the proof trigger, which used to wrap (`pre-wrap`). The trigger quotes a Postgres
  migration verbatim, and wrapping it mid-statement would misrepresent the source; shrinking its
  font to `0.66rem` is what keeps the unwrapped line inside the column instead.

### Navigation
- **Style:** sticky top nav, semi-transparent background (`color-mix` at 85% opacity) with
  `backdrop-filter: blur(10px)`, single bottom hairline. Fixed `3.75rem` height, matching
  Starlight's own `--sl-nav-height`.
- **Links:** plain text, `--ob-text-2` at rest, darkening to `--ob-text` on hover, no underline,
  no active-page indicator.
- **Theme toggle:** the nav's theme button carries `aria-pressed`, initialized from the resolved
  `data-theme` on page load and updated in the same click handler that writes the
  `starlight-theme` `localStorage` key, so assistive tech tracks the toggle's actual state
  instead of treating it as a stateless button.
- **Mobile menu (`.nav__menu`):** below `46rem` the inline link list is replaced, not just
  hidden, by a script-free `<details>` disclosure holding the same four links: a hamburger
  `summary` (hidden `::-webkit-details-marker`, `2rem` square, same hover/open border treatment
  as the theme toggle) opens an absolutely-positioned `.nav__menu-panel` anchored to the
  top-right of the nav, `12rem` minimum width, `--ob-shadow-lg`, `1px` border in
  `--ob-border-strong`, `8px` radius. `<details>` was chosen specifically to need no script and
  to stay reachable from the keyboard.

### Starlight overrides (shared identity, not a fork)
- Headings inherit the landing page's scale and tracking (`h2` at `1.75rem` with a bottom
  hairline rule, `h3` at `1.375rem`), so a reader moving from `/` into a docs page is not handed
  a visually different site.
- Tables carry more weight than prose on these pages (routes, flags, ports, columns): headers
  are uppercase, `0.75rem`, letter-spaced, tertiary-colored, sitting on a `--ob-border-strong`
  rule; body cells use plain hairline dividers and flush-left first columns (padding-left
  removed only on `:first-child`); numeric-looking single-code cells go `nowrap` so figures
  don't reflow.
- Inline code gets a `1px` border plus `4px` radius rather than only a background tint.
- Links inside prose underline at `45%` accent opacity and go to full accent color on hover,
  rather than a permanent solid underline.
- One shared `focus-visible` ring (`2px` solid accent, `2px` offset, `4px` radius) applies
  identically to links, buttons, summaries, and form controls across both surfaces. The rule
  lives solely in `tokens.css`, because the landing page never imports `starlight.css` and was
  falling back to the UA default outline. `starlight.css` used to carry an identical, redundant
  copy of the same declaration; that copy has been deleted, so there is now exactly one
  declaration as well as exactly one visual treatment. Verified still rendering inside
  Starlight by keyboard after the removal.

## Do's and Don'ts

### Do:
- **Do** keep every visual decision inside the `--ob-*` token layer in `tokens.css`. Neither
  surface (landing page, Starlight) should hardcode a color, size, or radius that could instead
  reference a token, that shared layer is the only thing keeping the two surfaces one identity.
- **Do** use jade narrowly, one primary action or one highlighted figure per view, never as a
  decorative fill.
- **Do** render code and terminal panels dark in both themes; they represent a terminal, not a
  themed UI surface.
- **Do** treat this as a deliberate commitment to the category standard (Stripe/Linear docs,
  Tailwind/Astro docs, Supabase/Bun craft level). A future contributor should not read the
  restraint here as an oversight and "fix" it by adding an invented visual flourish, a second
  accent color, or a decorative illustration system.
- **Do** keep the one authored motion moment as the only scripted animation: the proof section's
  three steps settling into place in sequence, once, on scroll into view via
  `IntersectionObserver`, guarded by `prefers-reduced-motion: reduce`. No other element on
  either surface animates on scroll, load, or hover beyond simple `0.15–0.18s` color/transform
  transitions.
- **Do** append new plain rules to `landing.css` above the `@media` blocks, never after them.
  This stylesheet's rule is that every top-level media query stays at the end of the file (the
  Media-Queries-Last Rule); an appended fix after that point silently loses to a narrow-viewport
  rule at equal specificity, and it has already happened twice.

### Don't:
- **Don't** add a shadow to an ordinary content card, button, or nav element. Shadows are
  reserved for framed product screenshots and inset code panels (the Frame-Not-Card Rule).
- **Don't** introduce a second accent color or a tinted/colored shadow. The palette is one
  neutral ramp plus one accent, and shadows stay achromatic (black-based) in both themes.
- **Don't** assume a future change at a narrow breakpoint or in light theme is safe just because
  this pass rendered and checked both (see Open decisions). That check was a point-in-time
  inspection, not a standing guarantee — re-verify the same way after touching layout or theme
  rules, rather than assuming the earlier pass still covers new work.

## Known inconsistencies / Open decisions

- **Light theme and narrow/mobile breakpoints have now been rendered and inspected, not just
  read from the cascade.** Checked in Chrome at 320, 360, 390, 768, 961, 1024, 1280, 1440 and
  1800px, in both light and dark. Findings: no page-level horizontal overflow at any width (after
  the hero-bleed fix, see Layout); the `<details>` mobile nav appears below `46rem`, opens, and
  its panel links measure about 45px tall; the figure strip reflows to a 2×2 grid; the light
  theme renders correctly throughout. This was a static inspection pass at a point in time, not
  an ongoing guarantee — treat new work at these sizes as unverified again once it changes
  anything this pass touched, rather than assuming this check still covers it.
- **`--ob-bg-sunken` and `--ob-radius-xl` are declared in `tokens.css` for both themes but are
  never referenced by any selector in `landing.css` or `starlight.css`.** Still true, checked by
  grep. Either a planned surface/shape never got built, or they're intentional headroom for a
  future component. Not removed here since the token layer is shared infrastructure and pruning
  it wasn't requested.
- **Density: `.honest` and one of the two forward `.client` rows have closed the empty-half gap
  this document used to log as open; the other has not been directly confirmed.** `.honest` grew
  a second column (intro on the left, the two facts and links on the right) instead of leaving
  about 40% of its row empty. The desktop-app client row's `.offline` definition list now fills
  what was roughly 200px of dead space beneath its copy with the offline-cache facts. The
  remaining forward row ("Statements for the meeting") gained no equivalent filler; the
  `client__frame .shot img` crop was changed to `16/9` specifically so the image stops growing
  taller than the copy beside it (see the comment above that rule in `landing.css`), which should
  narrow or close the same gap there, but that row hasn't been measured the way the other two
  were. The two reverse rows remain fixed for a different reason (terminal legibility, via the
  column-ratio inversion), which happens to read as less empty as a side effect.
- **Prose measure is inconsistently tokenized.** `--ob-measure` (`68ch`) is used for some prose
  blocks, while several component blurbs (`.client__text p`, `.install__text p`, `.section__head
  p` is untouched but others) hardcode their own `ch` caps (42–46ch) instead. Not a bug, but the
  measure token is a convention rather than an enforced rule.
- **Four literal colors sit outside the token layer by intent, for two different reasons.** The
  inset-panel foreground (`#d7dee2`, the `.code`/`.term` text color) and the inset-panel
  scrollbar thumb (`#3a4247`) belong to the always-dark code/terminal panels (see the
  Always-Dark Panel Rule): those panels render dark in both site themes, so a theme-following
  `--ob-*` token would flip them lighter in light mode and break that rule. The `ERROR` tag on
  `.proof__err span` (`#c2410c` light, `#f97316` dark) does follow the theme but is still
  literal, because promoting a second saturated color to the token layer would contradict the
  One Accent Rule — it is a deliberate one-off, used nowhere else on the site. The mechanical
  detector that flags undocumented palette entries catches all four; this bullet is the answer
  to that flag.
- **Three mono font sizes sit off the documented type ramp (`--ob-text-xs` at `0.75rem` is the
  smallest named step) by intent.** `0.8rem` on the install command block (`.code--install`) sizes
  up slightly from the `0.78rem` panel default because it is a real command meant to be read and
  copied, not a photograph of a terminal. `0.66rem` on the in-proof trigger (`.proof .code`) sizes
  down specifically so its quoted, unwrappable Postgres trigger fits the column without clipping
  (the `landing.css` comment above `.code` explains this). `0.58rem` on the captured terminal pane
  below the `46rem` breakpoint shrinks the same 80-column capture to fit a phone-width column.
  The mechanical off-ramp detector flags all three; this bullet is the answer to that flag.
