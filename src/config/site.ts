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

  /** Mainland China filing numbers; remove an entry to hide it. */
  beian: {
    icp: '京ICP备2022003459号-3',
    police: { text: '京公网安备11010502051390号', code: '11010502051390' },
  },

  meta: {
    zh: {
      title: 'Karl Lee',
      description: 'Karl 的个人网站：写过的文章、做过的小东西和常去的链接。',
    },
    en: {
      title: 'Karl Lee',
      description: "Karl's website: writing, things I've made, and links.",
    },
  },

  intro: {
    zh: {
      // The greeting is English on both locales.
      hello: "Hello, I'm Karl :)",
      prefix: '写代码，也做些',
      words: ['小工具', '小网页', '像素画', '小实验'],
      suffix: '。',
      // One line each, shown with a block marker in front.
      bio: ['不定期搓一些小而快，并且带一点点乐趣的东西。', '这里放我写的文章、做过的东西和常去的链接。'],
    },
    en: {
      hello: "Hello, I'm Karl :)",
      prefix: 'I write code and make ',
      words: ['small tools', 'tiny websites', 'pixel art', 'little experiments'],
      suffix: '.',
      bio: [
        'Every now and then I hack together small, quick things with a little fun in them.',
        "Here you'll find my writing, things I've made, and links I keep going back to.",
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
