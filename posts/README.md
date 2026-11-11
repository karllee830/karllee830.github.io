# Posts

Each post is a Markdown file in this folder. Files named `README.md` or starting with `_` are ignored.

Recommended layout — one folder per post, images next to the text:

```text
posts/
└── my-post/
    ├── index.md
    └── figure.png
```

The folder name becomes the URL: `/blog/my-post/` for Chinese posts, `/en/blog/my-post/` for English posts. Use lowercase ASCII and hyphens.

## Frontmatter

```yaml
---
title: Post title            # required
description: One-line summary
date: 2026-11-11             # required, controls ordering
updated: 2026-11-12          # optional
lang: zh                     # zh | en, defaults to zh
tags: [notes, astro]
draft: false                 # drafts only show in `npm run dev`
cover: ./cover.png           # optional cover image
coverAlt: Description of the cover
slug: custom-url             # optional, overrides the folder name
---
```

Reference images with relative paths, e.g. `![Alt text](./figure.png)`. They are optimised at build time.
