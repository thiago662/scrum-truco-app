// Roda um script de manutenção contra os EMULADORES locais (npm run emulators), nunca contra a produção:
// força as variáveis de emulator e o projeto demo, então nem a credencial real (se existir no
// ambiente) é usada. Uso: node scripts/local-admin.mjs <cleanup-rooms|purge-data> [args do script]
//   npm run local:cleanup
//   npm run local:purge -- --confirm        (KEEP_EMAILS=... no ambiente; ver README)
// Precisa de: npm install --no-save firebase-admin@14.5.0
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [name, ...args] = process.argv.slice(2);

if (!['cleanup-rooms', 'purge-data'].includes(name)) {
  console.error('Uso: node scripts/local-admin.mjs <cleanup-rooms|purge-data> [args]');
  process.exit(1);
}

const result = spawnSync(process.execPath, [fileURLToPath(new URL(`./${name}.mjs`, import.meta.url)), ...args], {
  stdio: 'inherit',
  env: {
    ...process.env,
    // 127.0.0.1 (e não "localhost"): onde o emulator escuta; evita o Node resolver pra ::1
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    GCLOUD_PROJECT: 'demo-scrum-truco',
    ALLOW_EMULATOR: '1',
  },
});

if (result.error) {
  console.error(`Não consegui rodar scripts/${name}.mjs: ${result.error.message}`);
}

process.exit(result.status ?? 1);
