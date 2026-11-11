---
title: Hello World
description: 排版样式测试。
date: 2026-11-12
lang: zh
tags: [test]
---

一段普通正文，中英文混排 English text，带 **粗体**、*斜体*、~~删除线~~、`行内代码`、[站内链接](/blog/) 和 [外部链接](https://astro.build)，以及键盘按键 <kbd>⌘</kbd> + <kbd>K</kbd>。

第二段正文，用来检查段落间距和较长文本的换行效果：Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

## 二级标题

### 三级标题

#### 四级标题

紧跟在标题后面的正文。

## 列表

- 无序列表项
- 带 `代码` 的列表项
  - 嵌套列表项
  - 嵌套列表项
- 无序列表项

1. 有序列表项
2. 有序列表项
   1. 嵌套有序列表项
   2. 嵌套有序列表项
3. 有序列表项

- [x] 已完成的任务
- [ ] 未完成的任务

## 引用

> 一段引用文字。
>
> 引用里的第二段，带 **强调**。

## 代码

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

## 表格

| 左对齐 | 居中 | 右对齐 |
| :--- | :---: | ---: |
| 单元格 | 单元格 | 1 |
| 较长的单元格内容 | `code` | 100 |

## 图片

![站点蓝色的柔和渐变](./gradient.jpg)

## 分隔线

上方内容。

---

下方内容。

## 脚注

带脚注的一句话[^1]。

[^1]: 脚注内容。
