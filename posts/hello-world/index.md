---
title: 你好，世界
description: 这个站点的第一篇文章，顺便说明怎么在这里写东西。
date: 2026-11-11
lang: zh
tags: [meta, astro]
---

这是博客的第一篇文章。整个站点基于 [Astro](https://astro.build) 构建，文章就是仓库里的 Markdown 文件，推送到 GitHub 之后会自动构建并发布到 GitHub Pages。

## 怎么写一篇新文章

在 `posts/` 下新建一个文件夹，放进 `index.md` 和要用到的图片：

```text
posts/
└── my-new-post/
    ├── index.md
    └── cover.png
```

`index.md` 的开头是一段 frontmatter：

```yaml
---
title: 文章标题
description: 一句话摘要（可选）
date: 2026-11-11
lang: zh        # zh 或 en
tags: [notes]
draft: false    # true 时只在本地预览可见
---
```

图片用相对路径引用即可，构建时会自动压缩并生成合适的尺寸：

![像素头像](./avatar.png)

## 一些排版

> 好的东西应该小而快，并且带一点点乐趣。

- 列表项一
- 列表项二，带一点 `inline code`
- 列表项三

| 键 | 作用 |
| --- | --- |
| `date` | 发布日期，决定排序 |
| `lang` | 文章语言，决定所在的语言路径 |
| `draft` | 草稿不会出现在线上 |

```ts
const greet = (name: string) => `Hello, ${name}!`;
console.log(greet('world'));
```

文章底部的评论来自 GitHub Issues，登录 GitHub 就能留言。
