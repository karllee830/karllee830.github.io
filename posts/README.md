# Posts

Each post is a Markdown file in this folder. Files named `README.md` or starting with `_` are ignored.

Recommended layout — one folder per post, images next to the text:

```text
posts/
└── my-post/
    ├── index.md
    └── figure.png
```

The folder name becomes the URL. Every post appears under both `/blog/my-post/` (Chinese interface) and `/en/blog/my-post/` (English interface); the text stays in the language it was written in. Use lowercase ASCII and hyphens.

## Translations

To publish a post in both languages, put the translation next to the original as `index.en.md` (or `index.zh.md` when the original is English):

```text
posts/
└── my-post/
    ├── index.md       # Chinese
    └── index.en.md    # English
```

Both share the URL name, and each locale shows its own version. Lists mark every post with a badge: 中 / EN for translated posts (the version on screen is highlighted), 中 or EN for posts in one language. A translated post's two versions share one comment thread.

## Frontmatter

```yaml
---
title: Post title            # required
description: One-line summary
date: 2026-11-11             # required, controls ordering
updated: 2026-11-12          # optional
lang: zh                     # zh | en, defaults to zh (a translation file's name sets it)
tags: [notes, astro]
draft: false                 # drafts only show in `npm run dev`
cover: ./cover.png           # optional cover image
coverAlt: Description of the cover
slug: custom-url             # optional, overrides the folder name
---
```

Reference images with relative paths, e.g. `![Alt text](./figure.png)`. They are optimised at build time.

Fence code with its language, e.g. ` ```python `, to get highlighting and a language label; every code block has a copy button.

To credit an image, give it a title: an image on its own line with a title gets that title as a caption underneath, and `[text](url)` inside it becomes a link.

```md
![Alt text](./figure.png "Photo: Jane Doe / [Unsplash](https://unsplash.com)")
```
