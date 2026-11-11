// Code blocks get a header: the language on the left (```python → "Python") and a copy
// button on the right. The button is wired up in the browser (src/lib/code-copy.ts).
// Runs after syntax highlighting, which leaves a <pre data-language="…">.

const NAMES = {
  astro: 'Astro',
  bash: 'Bash',
  c: 'C',
  cpp: 'C++',
  'c++': 'C++',
  cs: 'C#',
  csharp: 'C#',
  console: 'Console',
  css: 'CSS',
  dart: 'Dart',
  diff: 'Diff',
  docker: 'Dockerfile',
  dockerfile: 'Dockerfile',
  go: 'Go',
  graphql: 'GraphQL',
  html: 'HTML',
  ini: 'INI',
  java: 'Java',
  javascript: 'JavaScript',
  js: 'JavaScript',
  json: 'JSON',
  jsonc: 'JSON',
  jsx: 'JSX',
  kotlin: 'Kotlin',
  kt: 'Kotlin',
  lua: 'Lua',
  markdown: 'Markdown',
  md: 'Markdown',
  php: 'PHP',
  powershell: 'PowerShell',
  ps1: 'PowerShell',
  py: 'Python',
  python: 'Python',
  r: 'R',
  rb: 'Ruby',
  ruby: 'Ruby',
  rs: 'Rust',
  rust: 'Rust',
  scss: 'SCSS',
  sh: 'Shell',
  shell: 'Shell',
  sql: 'SQL',
  svelte: 'Svelte',
  swift: 'Swift',
  toml: 'TOML',
  ts: 'TypeScript',
  tsx: 'TSX',
  typescript: 'TypeScript',
  vue: 'Vue',
  xml: 'XML',
  yaml: 'YAML',
  yml: 'YAML',
  zsh: 'Zsh',
};

// Blocks without a real language get no label, only the copy button.
const UNLABELLED = new Set(['', 'text', 'txt', 'plain', 'plaintext']);

const svg = (className, d) => ({
  type: 'element',
  tagName: 'svg',
  properties: {
    className: [className],
    viewBox: '0 0 24 24',
    width: '16',
    height: '16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    ariaHidden: 'true',
  },
  children: [{ type: 'element', tagName: 'path', properties: { d }, children: [] }],
});

/** @type {import('satteri').HastPluginDefinition} */
export const codeBlocks = {
  name: 'code-blocks',
  element: {
    filter: ['pre'],
    visit(node, ctx) {
      const props = node.properties ?? {};
      if (props.dataCodeBlock !== undefined) return;
      const lang = String(props.dataLanguage ?? '').toLowerCase();
      const label = UNLABELLED.has(lang) ? '' : (NAMES[lang] ?? lang);

      ctx.replaceNode(node, {
        type: 'element',
        tagName: 'div',
        properties: { className: ['code-block'] },
        children: [
          {
            type: 'element',
            tagName: 'div',
            properties: { className: ['code-head'] },
            children: [
              { type: 'element', tagName: 'span', properties: { className: ['code-lang'] }, children: label ? [{ type: 'text', value: label }] : [] },
              {
                type: 'element',
                tagName: 'button',
                properties: { type: 'button', className: ['code-copy'], dataCopyCode: '', ariaLabel: 'Copy code', title: 'Copy code' },
                children: [
                  svg('copy-icon', 'M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1'),
                  svg('done-icon', 'M5 12.5l4.5 4.5L19 7.5'),
                ],
              },
            ],
          },
          { ...node, properties: { ...props, dataCodeBlock: '' } },
        ],
      });
    },
  },
};
