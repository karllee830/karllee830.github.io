import { withBase } from '../lib/url';

export const langs = ['zh', 'en'] as const;
export type Lang = (typeof langs)[number];
export const defaultLang: Lang = 'zh';

export const htmlLang: Record<Lang, string> = { zh: 'zh-CN', en: 'en' };
export const ogLocale: Record<Lang, string> = { zh: 'zh_CN', en: 'en_US' };

export const ui = {
  zh: {
    'skip': '跳到正文',
    'nav.label': '主导航',
    'nav.home': '首页',
    'nav.blog': '文章',
    'nav.links': '链接',
    'lang.label': '语言',
    'theme.label': '主题',
    'theme.system': '跟随系统',
    'theme.light': '浅色',
    'theme.dark': '深色',
    'home.writing': '最近的文章',
    'home.allPosts': '全部文章',
    'home.links': '链接',
    'home.empty': '还没有文章。',
    'avatar.label': '像素头像的字符画渲染，可用指针扰动',
    'avatar.modes': '渲染方式',
    'avatar.ascii': '字符',
    'avatar.pixel': '像素',
    'avatar.dots': '网点',
    'avatar.dither': '抖动',
    'avatar.replay': '重播',
    'blog.title': '文章',
    'blog.description': '写下来的东西。',
    'blog.count': '篇',
    'blog.otherLang': 'EN',
    'post.back': '全部文章',
    'post.minutes': '分钟',
    'post.updated': '更新于',
    'post.prev': '上一篇',
    'post.next': '下一篇',
    'post.comments': '评论',
    'post.commentsLoading': '评论加载中',
    'post.commentsNote': '评论基于 GitHub Issues，登录 GitHub 即可参与。',
    'outline.label': '本页目录',
    'outline.intro': '开头',
    'dock.menu': '菜单',
    'dock.close': '关闭',
    'end.title': '读完了，聊两句？',
    'end.body': '有想法、问题或者纠错，都欢迎留言，也可以通过下面的方式找到我。',
    'end.comment': '留言',
    'end.subscribe': '订阅 RSS',
    'post.home': '首页',
    'footer.site': '站点',
    'footer.elsewhere': '其他地方',
    'notFound.title': '这里什么都没有',
    'notFound.body': '页面可能被移动或删除了。',
    'notFound.home': '回到首页',
  },
  en: {
    'skip': 'Skip to content',
    'nav.label': 'Main',
    'nav.home': 'Home',
    'nav.blog': 'Writing',
    'nav.links': 'Links',
    'lang.label': 'Language',
    'theme.label': 'Theme',
    'theme.system': 'System',
    'theme.light': 'Light',
    'theme.dark': 'Dark',
    'home.writing': 'Recent writing',
    'home.allPosts': 'All posts',
    'home.links': 'Links',
    'home.empty': 'Nothing here yet.',
    'avatar.label': 'Pixel avatar rendered as ASCII; move the pointer to stir it',
    'avatar.modes': 'Render mode',
    'avatar.ascii': 'ASCII',
    'avatar.pixel': 'Pixel',
    'avatar.dots': 'Dots',
    'avatar.dither': 'Dither',
    'avatar.replay': 'Replay',
    'blog.title': 'Writing',
    'blog.description': 'Things written down.',
    'blog.count': 'posts',
    'blog.otherLang': '中文',
    'post.back': 'All posts',
    'post.minutes': 'min read',
    'post.updated': 'Updated',
    'post.prev': 'Previous',
    'post.next': 'Next',
    'post.comments': 'Comments',
    'post.commentsLoading': 'Loading comments',
    'post.commentsNote': 'Comments live in GitHub Issues — sign in with GitHub to join.',
    'outline.label': 'On this page',
    'outline.intro': 'Intro',
    'dock.menu': 'Menu',
    'dock.close': 'Close',
    'end.title': 'Thoughts?',
    'end.body': 'Questions, ideas or corrections are welcome in the comments, or reach me another way below.',
    'end.comment': 'Comment',
    'end.subscribe': 'Subscribe via RSS',
    'post.home': 'Home',
    'footer.site': 'Site',
    'footer.elsewhere': 'Elsewhere',
    'notFound.title': 'Nothing here',
    'notFound.body': 'The page may have moved or been removed.',
    'notFound.home': 'Back home',
  },
} as const;

/** One entry in a page outline (table of contents). */
export interface OutlineItem {
  id: string;
  text: string;
  depth: number;
}

export type UIKey = keyof (typeof ui)['zh'];

export function useTranslations(lang: Lang) {
  return (key: UIKey): string => ui[lang][key] ?? ui[defaultLang][key];
}

export function otherLang(lang: Lang): Lang {
  return lang === 'zh' ? 'en' : 'zh';
}

/** Path for a locale without the base prefix, e.g. ("en", "/blog/") -> "/en/blog/". */
export function localeRoute(lang: Lang, path = '/'): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return lang === defaultLang ? clean : `/${lang}${clean}`;
}

/** Same as localeRoute, with the base prefix applied. */
export function localePath(lang: Lang, path = '/'): string {
  return withBase(localeRoute(lang, path));
}
