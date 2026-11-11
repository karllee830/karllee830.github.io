import type { KubaiIconData } from 'kubai-icons';

/**
 * Every icon the site uses, by the name components ask for. Most come from Kubai Icons
 * (https://icons.kubai.design/, MIT); the brand marks it does not have are drawn here in
 * the same style. Each loads as its own chunk, so the browser fetches an icon's motion
 * only when it is needed.
 */
export const ICONS = {
  sun: () => import('kubai-icons/icons/sun'),
  moon: () => import('kubai-icons/icons/moon'),
  monitor: () => import('kubai-icons/icons/monitor'),
  rss: () => import('kubai-icons/icons/rss'),
  mail: () => import('kubai-icons/icons/mail'),
  pen: () => import('kubai-icons/icons/pen'),
  code: () => import('kubai-icons/icons/code'),
  link: () => import('kubai-icons/icons/link'),
  menu: () => import('kubai-icons/icons/menu'),
  list: () => import('kubai-icons/icons/list'),
  close: () => import('kubai-icons/icons/circle-x'),
  'chevron-up': () => import('kubai-icons/icons/chevron-up'),
  'chevron-down': () => import('kubai-icons/icons/chevron-down'),
  message: () => import('kubai-icons/icons/message-square'),
  github: () => import('./github'),
  x: () => import('./x'),
  wechat: () => import('./wechat'),
} satisfies Record<string, () => Promise<{ default: KubaiIconData }>>;

export type IconName = keyof typeof ICONS;
