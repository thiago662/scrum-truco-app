// Inicialização do Admin SDK dos scripts de manutenção (faxina, purge). Usa a conta de serviço
// (secret FIREBASE_SERVICE_ACCOUNT, ver README), que ignora firestore.rules.
import { initializeApp, cert } from 'firebase-admin/app';

const EMULATOR_VARS = ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST'];

export function initAdmin() {
  const emulators = EMULATOR_VARS.filter((name) => process.env[name]);

  if (emulators.length > 0) {
    // O Admin SDK manda tudo pro emulator quando essas variáveis existem, com ou sem credencial.
    // Sem o opt-in, uma variável esquecida no shell faria o script de "produção" rodar no emulator,
    // em silêncio.
    if (process.env.ALLOW_EMULATOR !== '1') {
      console.error(`Variável de emulator definida (${emulators.join(', ')}): o script rodaria no emulator, não em produção. Limpe-a (ou use ALLOW_EMULATOR=1, só nos testes).`);
      process.exit(1);
    }

    // testes (npm run test:cron): sem credencial
    initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'demo-admin-scripts' });
    return;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!raw) {
    console.error('Env FIREBASE_SERVICE_ACCOUNT ausente (ver README).');
    process.exit(1);
  }

  initializeApp({ credential: cert(JSON.parse(raw)) });
}

// "a@x.com, b@y.com" -> ['a@x.com', 'b@y.com'] (lista vem de secret; nunca vai pro log nem pro repo)
export function parseEmails(raw) {
  return (raw ?? '').split(',').map((email) => email.trim()).filter(Boolean);
}
