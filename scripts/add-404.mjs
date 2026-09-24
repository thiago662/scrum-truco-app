import { copyFileSync } from 'node:fs';

// O Pages não conhece /rooms/:id: cai no 404, e servir a própria casca da SPA como 404.html
// deixa o Angular assumir a rota (é isso que faz o link de convite abrir direto).
copyFileSync('dist/pages/browser/index.html', 'dist/pages/browser/404.html');

console.log('dist/pages/browser pronto (com 404.html).');
