/**
 * Copy buttons on code blocks (added at build time by src/lib/markdown/code-blocks.mjs):
 * a click puts the code on the clipboard and shows a tick for a moment.
 */

const LABELS = {
  zh: { copy: '复制代码', copied: '已复制' },
  en: { copy: 'Copy code', copied: 'Copied' },
};

export function initCodeCopy(root: ParentNode = document) {
  const labels = document.documentElement.lang.startsWith('zh') ? LABELS.zh : LABELS.en;
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-copy-code]')) {
    const code = button.closest('.code-block')?.querySelector('pre code');
    if (!code) continue;
    button.setAttribute('aria-label', labels.copy);
    button.title = labels.copy;
    let timer = 0;
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code.textContent?.replace(/\n$/, '') ?? '');
      } catch {
        // No clipboard access (an insecure page, or denied): leave the button as it is.
        return;
      }
      button.classList.add('is-copied');
      button.setAttribute('aria-label', labels.copied);
      button.title = labels.copied;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        button.classList.remove('is-copied');
        button.setAttribute('aria-label', labels.copy);
        button.title = labels.copy;
      }, 1600);
    });
  }
}
