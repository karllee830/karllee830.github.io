import type { Lang } from '../i18n/ui';

type Localized = string | Record<Lang, string>;

export interface SiteLink {
  label: Localized;
  detail: Localized;
  href: string;
  icon: 'github' | 'rss' | 'pen' | 'code' | 'mail' | 'x' | 'wechat' | 'link';
  /** Internal paths are resolved against the base path and current locale. */
  internal?: boolean;
  /** For internal links: whether the path should get the locale prefix. */
  localized?: boolean;
  /** Instead of linking, clicking copies this text (for IDs without a URL). */
  copy?: string;
}

export const site = {
  name: 'Karl Coding',
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
      title: 'Karl Coding',
      description: 'Karl 的个人网站：写过的文章、做过的小东西和常去的链接。',
    },
    en: {
      title: 'Karl Coding',
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
      label: 'X',
      detail: '@KarlLee830',
      href: 'https://x.com/KarlLee830',
      icon: 'x',
    },
    {
      label: { zh: '邮箱', en: 'Email' },
      detail: 'karllee0830@gmail.com',
      href: 'mailto:karllee0830@gmail.com',
      icon: 'mail',
    },
    {
      label: { zh: '微信', en: 'WeChat' },
      detail: 'KarlLee830',
      href: '',
      icon: 'wechat',
      copy: 'KarlLee830',
    },
    // Internal pages work too, e.g.:
    // { label: { zh: '文章', en: 'Writing' }, detail: '…', href: '/blog/', icon: 'pen', internal: true, localized: true },
  ] satisfies SiteLink[] as SiteLink[],

  /** Friends' sites, listed in the footer. */
  friends: [
    { label: '枯白啃设计', href: 'https://kubai.design/' },
    { label: 'Kubai Icons', href: 'https://icons.kubai.design/' },
  ],
};

export function localize(value: Localized, lang: Lang): string {
  return typeof value === 'string' ? value : value[lang];
}
