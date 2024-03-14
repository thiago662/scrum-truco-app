import { Injectable, inject } from '@angular/core';
import { Firestore, collectionData, updateDoc, addDoc, doc, collection, getDoc, getDocs, query, deleteDoc, FieldPath, deleteField } from '@angular/fire/firestore';
import { QueryConstraint, where } from 'firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export class RoomService {
  firestore: Firestore = inject(Firestore);

  constructor() { }

  async getRoom(id: any) {
    var room = await this.getFirebaseRoom(id);

    return await room;
  }

  async createRoom(room: any) {
    var roomFirebase = await this.setFirebaseRoom(room);

    return await roomFirebase;
  }

  async getFirebaseRoom(id: any) {
    const docRef = await doc(this.firestore, 'rooms', id);

    const docSnap = await getDoc(docRef);

    const roomFirebase: any = await docSnap.data();

    if (roomFirebase == undefined) {
      return await roomFirebase;
    }

    roomFirebase.id = await docRef.id;

    return await roomFirebase;
  }

  async setFirebaseRoom(room: any) {
    const roomCollection = await collection(this.firestore, 'rooms');

    const docRef = await addDoc(roomCollection, room);

    const docSnap = await getDoc(docRef);

    const roomFirebase: any = await docSnap.data();

    roomFirebase.id = await docRef.id;

    var roomReturn: any = await {
      id: docRef.id ?? '',
      title: roomFirebase?.title ?? '',
    }

    return await roomReturn;
  }

  async editFirebaseRoomField(id: any, field: any|FieldPath, value: any) {
    const docRef = await doc(this.firestore, 'rooms', id);

    await updateDoc(docRef, field, value);
  }

  async removeFirebaseRoom(id: any) {
    const docRef = await doc(this.firestore, 'rooms', id);

    await deleteDoc(docRef);
  }
}
