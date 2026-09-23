import { Component } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { serverTimestamp } from '@angular/fire/firestore';
import { RoomService } from '../room.service';
import { AuthService } from '../../auth/auth.service';
import { Room } from '../../model/room.model';

@Component({
  selector: 'app-room-add',
  templateUrl: './room-add.component.html',
  styleUrl: './room-add.component.scss'
})
export class RoomAddComponent {
  roomForm = new FormGroup({
    title: new FormControl(''),
    description: new FormControl(''),
  });

  constructor(
    private roomService: RoomService,
    private authService: AuthService,
    private router: Router,
  ) { }

  async createRoom() {
    var user = await this.authService.getCurrentUser();

    if (user?.id == null) {
      return;
    }

    var roomForm = this.roomForm.value;
    var title = roomForm?.title ?? '';

    var room: Room = {
      title,
      description: roomForm?.description ?? '',
      ownerId: user.id,
      controllerId: user.id,
      status: 'open',
      currentRoundId: null,
      members: {
        [user.id]: {
          name: user.name ?? '',
          role: 'owner',
          status: 'approved',
          joinedAt: serverTimestamp(),
        },
      },
      lastActivityAt: serverTimestamp(),
      ownerLastSeen: serverTimestamp(),
      createdAt: serverTimestamp(),
    };

    var roomId = await this.roomService.createRoom(room);

    await this.roomService.addToUserIndex(user.id, roomId, title);

    await this.router.navigate(['/rooms/' + roomId]);
  }
}
