import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, addDoc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collectionData, serverTimestamp, Unsubscribe } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Room } from '../model/room.model';

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
    await updateDoc(doc(this.firestore, 'rooms', id), { controllerId });
  }

  async closeRoom(id: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'rooms', id), { status: 'closed' });
  }

  async addToUserIndex(uid: string, roomId: string, title: string): Promise<void> {
    await setDoc(doc(this.firestore, 'users', uid, 'rooms', roomId), {
      roomId,
      title,
      joinedAt: serverTimestamp(),
    });
  }

  getUserRooms(uid: string): Observable<any[]> {
    return collectionData(collection(this.firestore, 'users', uid, 'rooms'), { idField: 'id' });
  }
}
