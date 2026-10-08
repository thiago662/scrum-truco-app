import { Injectable, inject } from '@angular/core';
import { DocumentData, Firestore, doc, getDoc } from '@angular/fire/firestore';

// DEFAULT_MAX_MEMBERS espelha firestore.rules; o teto de salas ativas não está nas rules
// (não dá pra contar documentos lá), então o padrão vive só aqui e no cron (ver
// CLAUDE.md, seção "Limites de uso").
export const DEFAULT_MAX_ACTIVE_ROOMS = 5;
export const DEFAULT_MAX_MEMBERS = 8;
export const UNLIMITED_MAX_MEMBERS = 1000;

export interface Limits {
  // Infinity quando `unlimited`; só se compara com contagem, nunca é gravado
  maxActiveRooms: number;
  maxMembers: number;
  unlimited: boolean;
}

// Só inteiro vale, como nas rules (`is int`): valor digitado errado no console cai pro próximo nível.
const intOr = (value: unknown, fallback: number): number => Number.isInteger(value) ? value as number : fallback;

// userLimits/{uid} → config/limits → padrão. `unlimited` ignora os números.
export function resolveLimits(global: DocumentData | undefined, user: DocumentData | undefined): Limits {
  if (user?.['unlimited'] === true) {
    return { maxActiveRooms: Infinity, maxMembers: UNLIMITED_MAX_MEMBERS, unlimited: true };
  }

  return {
    maxActiveRooms: intOr(user?.['maxActiveRooms'], intOr(global?.['maxActiveRooms'], DEFAULT_MAX_ACTIVE_ROOMS)),
    maxMembers: intOr(user?.['maxMembers'], intOr(global?.['maxMembers'], DEFAULT_MAX_MEMBERS)),
    unlimited: false,
  };
}

@Injectable({
  providedIn: 'root'
})
export class LimitsService {
  private firestore: Firestore = inject(Firestore);

  // Se a leitura falhar, cai nos padrões. Isso pode deixar a sala mais restrita que o limite
  // da conta (ou ter o create negado pelas rules, se o limite configurado for menor), mas
  // nunca burla as rules, que são quem decide de verdade.
  async getLimits(uid: string): Promise<Limits> {
    const [global, user] = await Promise.all([
      this.readDoc('config', 'limits'),
      this.readDoc('userLimits', uid),
    ]);

    return resolveLimits(global, user);
  }

  private async readDoc(collectionName: string, id: string): Promise<DocumentData | undefined> {
    try {
      const snapshot = await getDoc(doc(this.firestore, collectionName, id));
      return snapshot.exists() ? snapshot.data() : undefined;
    } catch (error) {
      console.warn(`Não consegui ler ${collectionName}/${id}; usando os limites padrão.`, error);
      return undefined;
    }
  }
}
