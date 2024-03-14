import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, collectionData, addDoc, doc, collection, setDoc, getDoc, getDocFromServer, updateDoc, onSnapshot, getDocs, query, DocumentReference, FieldPath } from '@angular/fire/firestore';
import { Observable, Subject, map, switchMap } from 'rxjs';
import { NavService } from '../../nav/nav.service';

@Component({
  selector: 'app-room-view',
  templateUrl: './room-view.component.html',
  styleUrl: './room-view.component.scss'
})
export class RoomViewComponent {
  id: any = null;
  isVisible: any = true;
  points: any;
  room: any;
  user: any;
  users: any;

  firestore: Firestore = inject(Firestore);

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private navService: NavService,
  ) {
    this.id = this.route.snapshot.params['id'];

    this.getFirebaseRoom(this.id);

    this.getUser();
  }

  async getUser() {
    var user: any = await this.navService.getUser();

    this.user = await user;
  }

  async getFirebaseRoom(id: any) {
    const docRef = doc(this.firestore, 'rooms', this.id);

    const unsub = onSnapshot(docRef, (snapshot) => {
      this.room = snapshot.data();

      this.points = this.room?.points;

      const indexx = Object.keys(this.room?.users);

      let arr = [];

      for (let index = 0; index < indexx.length; index++) {
        arr.push(this.room?.users[indexx[index]]);
      }

      this.users = arr;
    });
  }

  async show() {
    const docRef = await doc(this.firestore, 'rooms', this.id);

    await updateDoc(docRef, 'isVisible', !this.room?.isVisible);
  }

  async reset() {
    const docRef = await doc(this.firestore, 'rooms', this.id);

    const indexx = Object.keys(this.room?.users);

    let arr = [];

    for (let index = 0; index < indexx.length; index++) {
      await updateDoc(docRef, new FieldPath('users', indexx[index], 'value'), '');
      await updateDoc(docRef, new FieldPath('users', indexx[index], 'selected'), false);
    }
  }

  async saveRoom() {
    const docRef = await doc(this.firestore, 'rooms', this.id);

    await updateDoc(docRef, new FieldPath('users', this.user?.id), {
      'id': this.user?.id,
      'name': this.user?.name,
      'selected': false,
      'value': '',
    });

    await this.user.rooms.push({
      id: this.id ?? '',
      title: this.room?.title ?? '',
      description: this.room?.description ?? '',
    });

    await this.navService.updateUser(this.user?.id, this.user);
  }

  async sendValue(point: any) {
    const docRef = await doc(this.firestore, 'rooms', this.id);

    await updateDoc(docRef, new FieldPath('users', this.user?.id, 'value'), point?.value);
    await updateDoc(docRef, new FieldPath('users', this.user?.id, 'selected'), true);
  }
}
