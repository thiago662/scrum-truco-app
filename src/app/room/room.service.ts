import { Injectable, inject } from '@angular/core';
import { Firestore, Timestamp, collection, doc, addDoc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collectionData, serverTimestamp, deleteField, FieldPath, Unsubscribe } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Room, RoomIndexEntry } from '../model/room.model';

// Fase 2: encerramento automático. As rules são a fonte de verdade (comparam com o
// relógio do servidor); estes valores só decidem quando o cliente tenta encerrar.
export const HEARTBEAT_INTERVAL_MS = 45_000;
export const OWNER_GONE_TOLERANCE_MS = 2 * 60_000;
export const INACTIVITY_TOLERANCE_MS = 60 * 60_000;
export const DELETE_AFTER_CLOSE_MS = 24 * 60 * 60_000;
// mais curto que as tolerâncias acima só pra reagir num tempo razoável, sem sobrecarregar
export const STALE_CHECK_INTERVAL_MS = 30_000;

export function toMillis(value: any): number | null {
  return typeof value?.toMillis === 'function' ? value.toMillis() : null;
}

@Injectable({
  providedIn: 'root'
})
export class RoomService {
  firestore: Firestore = inject(Firestore);

  constructor() { }

  async createRoom(room: Room): Promise<string> {
    const roomCollection = collection(this.firestore, 'rooms');

    const docRef = await addDoc(roomCollection, room);

    return docRef.id;
  }

  async getRoom(id: string): Promise<Room | undefined> {
    const docSnap = await getDoc(doc(this.firestore, 'rooms', id));

    if (!docSnap.exists()) {
      return undefined;
    }

    return { id: docSnap.id, ...docSnap.data() } as Room;
  }

  listenRoom(id: string, onChange: (room: Room | undefined) => void): Unsubscribe {
    return onSnapshot(doc(this.firestore, 'rooms', id), (snapshot) => {
      onChange(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } as Room : undefined);
    });
  }

  async updateControllerId(id: string, controllerId: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'rooms', id), { controllerId, lastActivityAt: serverTimestamp() });
  }

  async requestJoin(id: string, uid: string, name: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'rooms', id), new FieldPath('members', uid), {
      name,
      role: 'member',
      status: 'pending',
      joinedAt: serverTimestamp(),
    });
  }

  async approveMember(id: string, uid: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'rooms', id), {
      [`members.${uid}.status`]: 'approved',
      lastActivityAt: serverTimestamp(),
    });
  }

  async removeMember(id: string, uid: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'rooms', id), {
      [`members.${uid}`]: deleteField(),
      lastActivityAt: serverTimestamp(),
    });
  }

  async closeRoom(id: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'rooms', id), {
      status: 'closed',
      deleteAt: Timestamp.fromMillis(Date.now() + DELETE_AFTER_CLOSE_MS),
    });
  }

  // Chamado periodicamente por qualquer membro aprovado enquanto vê a sala. A decisão real
  // é das rules (comparam com o relógio do servidor) — isto só evita tentativas óbvias.
  async checkStaleAndClose(room: Room): Promise<void> {
    if (room.id == null || room.status !== 'open') {
      return;
    }

    const now = Date.now();
    const ownerLastSeenMs = toMillis(room.ownerLastSeen);
    const lastActivityMs = toMillis(room.lastActivityAt);

    const ownerGone = ownerLastSeenMs != null && now - ownerLastSeenMs > OWNER_GONE_TOLERANCE_MS;
    const inactive = lastActivityMs != null && now - lastActivityMs > INACTIVITY_TOLERANCE_MS;

    if (ownerGone || inactive) {
      await this.closeRoom(room.id);
    }
  }

  // Só o dono chama; roda enquanto ele estiver vendo a própria sala (ver room-view).
  startOwnerHeartbeat(roomId: string): () => void {
    const roomRef = doc(this.firestore, 'rooms', roomId);
    const tick = () => { updateDoc(roomRef, { ownerLastSeen: serverTimestamp() }).catch(() => { }); };

    tick();
    const intervalId = setInterval(tick, HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }

  async addToUserIndex(uid: string, roomId: string, title: string): Promise<void> {
    await setDoc(doc(this.firestore, 'users', uid, 'rooms', roomId), {
      roomId,
      title,
      joinedAt: serverTimestamp(),
    });
  }

  async removeFromUserIndex(uid: string, roomId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'users', uid, 'rooms', roomId));
  }

  getUserRooms(uid: string): Observable<RoomIndexEntry[]> {
    return collectionData(collection(this.firestore, 'users', uid, 'rooms'), { idField: 'id' }) as Observable<RoomIndexEntry[]>;
  }
}
