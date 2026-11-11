---
title: Hello World
description: A typesetting style test.
date: 2026-11-12
tags: [test]
---

A plain paragraph with mixed scripts 中文混排, **bold**, *italic*, ~~strikethrough~~, `inline code`, an [internal link](/en/blog/) and an [external link](https://astro.build), plus keys <kbd>⌘</kbd> + <kbd>K</kbd>.

A second paragraph to check paragraph spacing and how longer text wraps: Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

## Heading level 2

### Heading level 3

#### Heading level 4

Body text right after a heading.

## Lists

- Unordered item
- Item with `code`
  - Nested item
  - Nested item
- Unordered item

1. Ordered item
2. Ordered item
   1. Nested ordered item
   2. Nested ordered item
3. Ordered item

- [x] Done task
- [ ] Open task

## Quote

> A quoted paragraph.
>
> A second paragraph in the quote, with **emphasis**.

## Code

```ts
interface Post {
  title: string;
  date: Date;
}

const greet = (name: string) => `Hello, ${name}!`;
console.log(greet('world'));
```

```bash
npm install
npm run dev
```

```css
.prose {
  color: var(--color-fg);
}
```

## Table

| Left | Center | Right |
| :--- | :---: | ---: |
| Cell | Cell | 1 |
| A longer cell | `code` | 100 |

## Image

![A soft gradient in the site blue](./gradient.jpg "Test image")

## Rule

Above the rule.

---

Below the rule.

## Footnote

A sentence with a footnote[^1].

[^1]: The footnote text.
