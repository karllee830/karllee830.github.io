---
title: Hello, world
description: The first post on this site, and how to write one here.
date: 2026-11-11
tags: [meta, astro]
---

This is the first post on the blog. The site is built with [Astro](https://astro.build); posts are Markdown files in the repository, and pushing to GitHub builds and publishes them to GitHub Pages.

## Writing a new post

Create a folder under `posts/` with an `index.md` and the images it uses:

```text
posts/
└── my-new-post/
    ├── index.md
    ├── index.en.md   # optional English version
    └── cover.png
```

`index.md` starts with frontmatter:

```yaml
---
title: Post title
description: One-line summary (optional)
date: 2026-11-11
lang: zh        # zh or en
tags: [notes]
draft: false    # true keeps it to local previews
---
```

Reference images with relative paths; they are compressed and resized at build time:

![Pixel avatar](./avatar.png)

## Some typesetting

> Good things should be small and fast, with a little fun in them.

- First item
- Second item, with a bit of `inline code`
- Third item

| Key | What it does |
| --- | --- |
| `date` | Publish date, sets the order |
| `lang` | Language of the text |
| `draft` | Drafts stay off the live site |

```ts
const greet = (name: string) => `Hello, ${name}!`;
console.log(greet('world'));
```

Comments at the bottom come from GitHub Issues; sign in with GitHub to leave one.
