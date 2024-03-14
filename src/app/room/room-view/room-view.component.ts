import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, collectionData, addDoc, doc, collection, setDoc, getDoc, getDocFromServer, updateDoc, onSnapshot, getDocs, query, DocumentReference, FieldPath, deleteField, arrayRemove, deleteDoc } from '@angular/fire/firestore';
import { Observable, Subject, map, switchMap } from 'rxjs';
import { NavService } from '../../nav/nav.service';
import { RoomService } from '../room.service';

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
  userConfig: any;
  users: any;

  firestore: Firestore = inject(Firestore);

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private navService: NavService,
    private roomService: RoomService,
  ) {
    this.id = this.route.snapshot.params['id'];

    this.initRoom();
  }

  async initRoom() {
    await this.getUser();

    await this.getFirebaseRoom(this.id);
  }

  async getUser() {
    var user: any = await this.navService.getUser();

    this.user = await user;
  }

  async getFirebaseRoom(id: any) {
    const docRef = await doc(this.firestore, 'rooms', id);

    const unsub = await onSnapshot(docRef, (snapshot) => {
      this.room = snapshot.data();

      if (this.room == undefined) {
        this.router.navigate(['/rooms/']);
      }

      this.points = this.room?.points;

      const users = Object.keys(this.room?.users);

      let arrayUsers = [];

      for (let indexUserId = 0; indexUserId < users.length; indexUserId++) {
        arrayUsers.push(this.room?.users[users[indexUserId]]);

        if (this.user?.id == users[indexUserId]) {
          this.userConfig = this.room?.users[users[indexUserId]];
        }
      }

      this.users = arrayUsers;
    });
  }

  async sendValue(point: any) {
    await this.roomService.editFirebaseRoomField(this.id, new FieldPath('users', this.user?.id, 'value'), point?.value);
    await this.roomService.editFirebaseRoomField(this.id, new FieldPath('users', this.user?.id, 'selected'), true);
  }

  async showCards() {
    await this.roomService.editFirebaseRoomField(this.id, 'isVisible', !this.room?.isVisible);
  }

  async resetCards() {
    const users = await Object.keys(this.room?.users);

    for (let indexUserId = 0; indexUserId < users.length; indexUserId++) {
      await this.roomService.editFirebaseRoomField(this.id, new FieldPath('users', users[indexUserId], 'value'), '');
      await this.roomService.editFirebaseRoomField(this.id, new FieldPath('users', users[indexUserId], 'selected'), false);
    }

    await this.showCards();
  }

  async saveRoom() {
    await this.roomService.editFirebaseRoomField(this.id, new FieldPath('users', this.user?.id), {
      'id': this.user?.id,
      'name': this.user?.name,
      'selected': false,
      'value': '',
    });

    this.user.rooms[this.id] = await {
      'id': this.id ?? '',
      'title': this.room?.title ?? '',
      'description': this.room?.description ?? '',
    };

    await this.navService.updateUser(this.user?.id, this.user);
  }

  async removeRoom() {
    this.roomService.editFirebaseRoomField(this.id, new FieldPath('users', this.user?.id), deleteField());

    this.navService.editFirebaseUserFild(this.user?.id, new FieldPath('rooms', this.id), deleteField());

    this.userConfig = null;
  }

  async deleteRoom() {
    const users = await Object.keys(this.room?.users);

    for (let indexUserId = 0; indexUserId < users.length; indexUserId++) {
      await this.navService.editFirebaseUserFild(users[indexUserId], new FieldPath('rooms', this.id), deleteField());
    }

    await this.roomService.removeFirebaseRoom(this.id);
  }
}
