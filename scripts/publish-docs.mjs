import { copyFileSync, cpSync, rmSync } from 'node:fs';

// Troca o conteúdo de docs/ (servido pelo GitHub Pages) pelo build sem SSR.
// O 404.html é a própria casca da SPA: o Pages não conhece /rooms/:id, cai no 404 e o Angular assume a rota.
rmSync('docs', { recursive: true, force: true });
cpSync('dist/pages/browser', 'docs', { recursive: true });
copyFileSync('docs/index.html', 'docs/404.html');

console.log('docs/ atualizado (com 404.html). Revise o git diff antes de commitar.');
