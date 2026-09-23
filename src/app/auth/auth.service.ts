import { Injectable, inject } from '@angular/core';
import { Auth, authState, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInAnonymously, signOut } from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp } from '@angular/fire/firestore';
import { Observable, switchMap, firstValueFrom } from 'rxjs';
import { User } from '../model/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);

  currentUser$: Observable<User | null> = authState(this.auth).pipe(
    switchMap((firebaseUser) => this.toUser(firebaseUser))
  );

  private async toUser(firebaseUser: any): Promise<User | null> {
    if (firebaseUser == null) {
      return null;
    }

    if (firebaseUser.isAnonymous) {
      return new User(firebaseUser.uid, firebaseUser.displayName ?? '', '', '', true);
    }

    const docRef = doc(this.firestore, 'users', firebaseUser.uid);
    const docSnap = await getDoc(docRef);
    const data: any = docSnap.data() ?? {};

    return new User(firebaseUser.uid, data.name ?? '', firebaseUser.email ?? '', data.companyName ?? '');
  }

  async getCurrentUser(): Promise<User | null> {
    return await firstValueFrom(this.currentUser$);
  }

  async register(email: string, password: string, name: string, companyName: string): Promise<User> {
    const credential = await createUserWithEmailAndPassword(this.auth, email, password);

    await setDoc(doc(this.firestore, 'users', credential.user.uid), {
      name,
      email,
      companyName,
      createdAt: serverTimestamp(),
    });

    return new User(credential.user.uid, name, email, companyName);
  }

  async login(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email, password);
  }

  async loginAsGuest(): Promise<User> {
    const credential = await signInAnonymously(this.auth);

    return new User(credential.user.uid, '', '', '', true);
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }

  async updateProfile(uid: string, fields: { name: string; companyName: string }): Promise<void> {
    await updateDoc(doc(this.firestore, 'users', uid), fields);
  }

  async deleteAccount(uid: string): Promise<void> {
    // ponytail: auth.currentUser.delete() exige login recente (auth/requires-recent-login),
    // sem fluxo de reautenticação nessa fase. Deleta a conta de Auth primeiro: se isso falhar,
    // o perfil no Firestore continua intacto (órfão sem Auth já seria pior, bloquearia recadastro).
    await this.auth.currentUser?.delete();

    await deleteDoc(doc(this.firestore, 'users', uid));
  }
}
