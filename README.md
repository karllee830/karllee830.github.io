# Karl Coding — homepage & blog

A small personal site built with [Astro](https://astro.build) and React islands, deployed to GitHub Pages. Chinese and English, light and dark, blog posts written as Markdown in this repository, comments stored in GitHub Issues.

## Quick start

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in dist/
npm run check    # type-check .astro / .ts files
```

Node 22.23 or newer is required.

## Writing a post

1. Create a folder in [`posts/`](posts/) with an `index.md` and any images it uses.
2. Add frontmatter (`title`, `date` and optionally `lang`, `tags`, `description`, `cover`, `draft`).
3. Commit and push to `main` — or upload the folder through GitHub's web UI. The deploy workflow rebuilds the site.

See [`posts/README.md`](posts/README.md) for every frontmatter field. Chinese posts are served under `/blog/<folder>/`, English posts under `/en/blog/<folder>/`; both blog indexes list every post.

## Comments

Comments live in GitHub Issues and are reviewed before they appear on the site.

- Each post has one issue, titled `blog/<slug>` and labelled `comment`; the deploy workflow opens missing ones. Both language versions of a post share it.
- Visitors comment on that issue (the post links to it). [`.github/workflows/comments.yml`](.github/workflows/comments.yml) answers each new comment with a review note holding two checkboxes, **Approve** and **Reject**.
- Tick one: the note records the decision and, on approval, redeploys the site. Approved notes offer **Undo** to review again. Only people with write access can decide.
- The site is static, so comments are fetched while building ([`src/lib/comments.ts`](src/lib/comments.ts)): the owner's comments and approved ones, in GitHub's sanitised HTML. Editing an approved comment sends it back to review.

Setup: the repository must be public, and `comments` in [`src/config/site.ts`](src/config/site.ts) must point at it (`enabled: false` turns comments off). Pending comments are visible on GitHub itself, only not on the site.

## Deploying to GitHub Pages

1. In the repository settings, open **Pages** and set **Source** to **GitHub Actions**.
2. Push to `main`. [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds and publishes the site.

The workflow passes the Pages URL and base path to the build, so the same code works for a user site (`<name>.github.io`) and a project site (`<name>.github.io/<repo>/`). For local builds you can set them yourself:

```bash
SITE_URL=https://example.github.io BASE_PATH=/my-repo npm run build
```

## Customising

| What | Where |
| --- | --- |
| Name, intro, rotating words, links, comments | [`src/config/site.ts`](src/config/site.ts) |
| UI strings (zh / en) | [`src/i18n/ui.ts`](src/i18n/ui.ts) |
| Colours, spacing, radius, type, motion | [`src/styles/tokens.css`](src/styles/tokens.css) |
| Avatar | replace [`src/assets/avatar.svg`](src/assets/avatar.svg), then run `npm run avatar` |

The avatar must be a pixel-art SVG built from `<rect>` elements with a `viewBox`; the first full-size rect is treated as the background. `npm run avatar` regenerates [`src/data/avatar.ts`](src/data/avatar.ts), which drives the hero canvas, the small header mark and the favicon. Also replace `public/avatar.png`.

## Design notes

- **Tokens.** Every colour, spacing, radius, type size and duration is a CSS custom property in `tokens.css`. Spacing and radii sit on a 4px grid.
- **Concentric corners.** A nested surface uses the parent radius minus the padding between them (for example a 32px segmented control with 4px inset has 8px-radius segments inside a 12px-radius frame).
- **Continuous corners.** Rounded surfaces use the `.sq` class. Browsers that support `corner-shape: squircle` render it natively; elsewhere (Safari, Firefox) [`src/lib/squircle.ts`](src/lib/squircle.ts) applies an equivalent clip-path and draws `.sq-line` borders as a 1px ring so they follow the curve.
- **Colour.** Neutral greys only, plus one accent taken from the avatar's cap band (`#669fd0`). Surfaces are flat; the link cards are the one tactile exception (raised gradient and a dark tray that slides out with the URL), with their shadow tokens in `tokens.css`.
- **Icons.** [Kubai Icons](https://icons.kubai.design/) (MIT), registered in [`src/lib/icons`](src/lib/icons/index.ts); the brand marks the set lacks (GitHub, X, WeChat) are drawn there in the same style. Icons render to static SVG at build time and load their hover motion on first hover. Every shade comes from one ink, `--color-icon`, except the link cards, which use the accent.
- **Motion.** Per-character reveal on headings, a decode effect on the rotating word, and a canvas rendering of the avatar that cycles through seven styles (ASCII, dither, pixel, dots, cross, braille, hatch); each switch sends one ripple across the page margins and footer, and the pointer reveals the original colours. The canvas loop only runs while something moves and pauses off-screen. `prefers-reduced-motion` turns the decorative motion off.

## Performance

- Static HTML; JavaScript only for the hero islands on the home page and a ~2 KB script for theme and corners elsewhere.
- Latin subsets of Google Sans Flex and Google Sans Code (SIL Open Font License) are self-hosted with metric-matched fallbacks; Chinese text uses system fonts.
- Post images are converted to WebP with responsive sizes at build time.
- Comments are part of the static page; only commenters' avatars load from GitHub.

## Project layout

```text
posts/                  Markdown posts and their images
public/                 Files copied as-is (avatar, badges)
scripts/                Avatar → matrix converter
src/
  components/           Astro components (+ react/ islands)
  config/site.ts        Site content and links
  data/avatar.ts        Generated avatar matrix
  i18n/ui.ts            Translations and locale helpers
  layouts/              Page shell
  lib/                  Canvas engine, squircles, posts, URLs
  pages/                Routes (zh at /, en at /en/)
  styles/               Tokens, base, controls, prose
  views/                Page bodies shared by both locales
```
