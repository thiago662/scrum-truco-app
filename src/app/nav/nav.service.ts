import { Injectable, inject } from '@angular/core';
import { Firestore, collectionData, updateDoc, addDoc, doc, collection, getDoc, getDocs, query, deleteDoc, FieldPath, deleteField } from '@angular/fire/firestore';
import { QueryConstraint, where } from 'firebase/firestore';
import { User } from '../model/user.model';

@Injectable({
  providedIn: 'root'
})
export class NavService {
  firestore: Firestore = inject(Firestore);

  constructor() { }

  async getUser() {
    var userLocal = await this.getLocalStoregeUser();

    if (userLocal == null) {
      return await null;
    }

    var userFirebase = await this.getFirebaseUser(userLocal?.id);

    if (userFirebase == null) {
      return await null;
    }

    return await userFirebase;
  }

  async createUser(user: any) {
    var userFirebase = await this.setFirebaseUser(user);

    var userFirebase: any = await this.editFirebaseUser(userFirebase?.id, userFirebase);

    await this.setLocalStoregeUser(userFirebase);

    return await userFirebase;
  }

  async updateUser(id: any, user: any) {
    var userFirebase: any = await this.editFirebaseUser(id, user);

    await this.setLocalStoregeUser(userFirebase);

    return await userFirebase;
  }

  async deleteUser(id: any) {
    await this.removeFirebaseUser(id);

    await this.removeLocalStoregeUser();
  }

  async loginUser(email: any, password: any) {
    var userFirebase = await this.queryLoginFirebaseUser(email, password);

    await this.setLocalStoregeUser(userFirebase);

    return await userFirebase;
  }

  async checkLoginUser() {
    var userLocal = await this.getLocalStoregeUser();

    if (userLocal == null) {
      return await false;
    }

    var userFirebase = await this.getFirebaseUser(userLocal?.id);

    if (userFirebase == null) {
      return await false;
    }

    return await true;
  }

  async getFirebaseUser(id: any) {
    const docRef = await doc(this.firestore, 'users', id);

    const docSnap = await getDoc(docRef);

    const userFirebase: any = await docSnap.data();

    userFirebase.id = await docRef.id;

    return await userFirebase;
  }

  async setFirebaseUser(user: any) {
    const userCollection = await collection(this.firestore, 'users');

    const docRef = await addDoc(userCollection, user);

    const docSnap = await getDoc(docRef);

    const userFirebase: any = await docSnap.data();

    userFirebase.id = await docRef.id;

    var userReturn: any = await {
      id: docRef.id ?? '',
      name: userFirebase?.name ?? '',
      email: userFirebase?.email ?? '',
      password: userFirebase?.password ?? '',
      rooms: userFirebase?.rooms ?? [],
    }

    return await userReturn;
  }

  async editFirebaseUser(id: any, user: any) {
    var userFirebase: any = await user;

    const docRef = await doc(this.firestore, 'users', id);

    await updateDoc(docRef, userFirebase);

    return await user;
  }

  async editFirebaseUserFild(id: any, field: any|FieldPath, value: any) {
    const docRef = await doc(this.firestore, 'users', id);

    await updateDoc(docRef, field, value);
  }

  async removeFirebaseUser(id: any) {
    const docRef = await doc(this.firestore, 'users', id);

    await deleteDoc(docRef);
  }

  async queryLoginFirebaseUser(email: any, password: any) {
    const ref = await collection(this.firestore, 'users');

    const wa:QueryConstraint[] = await [
      where('email', '==', email),
      where('password', '==', password)
    ];

    const refq = await query(ref,...wa);

    const querySnapshot = await getDocs(refq);

    var user;
    var countUser = 0;

    (await querySnapshot).forEach((element) => {
      countUser++;

      var userServe = element.data();

      user = {
        id: userServe['id'] ?? '',
        name: userServe['name'] ?? '',
        email: userServe['email'] ?? '',
        password: userServe['password'] ?? '',
      };
    });

    if (countUser == 1) {
      return user;
    } else {
      return null;
    }
  }

  async checkEmailExistFirebase(email: any) {
    const ref = await collection(this.firestore, 'users');

    const refq = await query(ref,where('email', '==', email));

    const querySnapshot = getDocs(refq);

    var countUser = 0;

    (await querySnapshot).forEach((element) => { countUser++; });

    return countUser > 0;
  }

  async getLocalStoregeUser() {
    if (typeof window !== 'undefined') {
      var user: any = await JSON.parse(localStorage.getItem('user') ?? '') ?? null;
  
      return await user;
    } else {
      return await null;
    }
  }

  async setLocalStoregeUser(user: any) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(user));
    }
  }

  async removeLocalStoregeUser() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user');
    }
  }

  async getUsersRooms() {
    var user: any = await this.getUser();

    return await user?.rooms ?? [];
  }
}
