import type { Lang } from '../i18n/ui';

type Localized = string | Record<Lang, string>;

export interface SiteLink {
  label: Localized;
  detail: Localized;
  href: string;
  icon: 'github' | 'rss' | 'pen' | 'code' | 'mail' | 'x' | 'link';
  /** Internal paths are resolved against the base path and current locale. */
  internal?: boolean;
  /** For internal links: whether the path should get the locale prefix. */
  localized?: boolean;
}

export const site = {
  name: 'Karl Lee',
  /** Drawn as the pixel wordmark in the footer (A–Z, 0–9). */
  wordmark: 'KARL',
  github: 'karllee830',
  /** Repository that hosts this site. */
  repo: 'karllee830/HomePageTry4',

  /**
   * Issue-based comments via utterances.
   * Install https://github.com/apps/utterances on `repo` before enabling.
   */
  comments: {
    enabled: true,
    repo: 'karllee830/HomePageTry4',
    label: 'comment',
  },

  meta: {
    zh: {
      title: 'Karl Lee',
      description: 'Karl 的个人主页与博客：工具、界面和一些好玩的小实验。',
    },
    en: {
      title: 'Karl Lee',
      description: "Karl's homepage and blog — tools, interfaces and small experiments.",
    },
  },

  intro: {
    zh: {
      hello: '你好，我是 Karl。',
      prefix: '一个喜欢折腾',
      words: ['小工具', '界面', '终端', '像素'],
      suffix: '的 geek。',
      bio: [
        '我相信好的东西应该小而快，并且带一点点乐趣。这里记录我在做的东西、读到的东西，以及偶尔冒出来的想法。',
      ],
    },
    en: {
      hello: "Hi, I'm Karl.",
      prefix: 'A geek who tinkers with ',
      words: ['tools', 'interfaces', 'terminals', 'pixels'],
      suffix: '.',
      bio: [
        'I like things that are small, fast and a little bit fun. This is where I keep what I build, what I read, and the odd idea in between.',
      ],
    },
  },

  links: [
    {
      label: 'GitHub',
      detail: '@karllee830',
      href: 'https://github.com/karllee830',
      icon: 'github',
    },
    {
      label: { zh: '文章', en: 'Writing' },
      detail: { zh: '写下来的东西', en: 'Things written down' },
      href: '/blog/',
      icon: 'pen',
      internal: true,
      localized: true,
    },
    {
      label: 'RSS',
      detail: 'rss.xml',
      href: '/rss.xml',
      icon: 'rss',
      internal: true,
    },
    {
      label: { zh: '本站源码', en: 'Source' },
      detail: 'HomePageTry4',
      href: 'https://github.com/karllee830/HomePageTry4',
      icon: 'code',
    },
    // More examples:
    // { label: 'X', detail: '@handle', href: 'https://x.com/handle', icon: 'x' },
    // { label: 'Email', detail: 'you@example.com', href: 'mailto:you@example.com', icon: 'mail' },
  ] satisfies SiteLink[] as SiteLink[],
};

export function localize(value: Localized, lang: Lang): string {
  return typeof value === 'string' ? value : value[lang];
}
