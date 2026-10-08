import { Component } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { serverTimestamp } from '@angular/fire/firestore';
import { RoomService } from '../room.service';
import { LimitsService } from '../limits.service';
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
    private limitsService: LimitsService,
    private authService: AuthService,
    private router: Router,
  ) { }

  creating = false;

  async createRoom() {
    // lê usuário e limites antes de criar: sem a trava, um clique duplo nessa janela criaria duas salas
    if (this.creating) {
      return;
    }

    this.creating = true;

    try {
      await this.doCreateRoom();
    } finally {
      this.creating = false;
    }
  }

  private async doCreateRoom() {
    var user = await this.authService.getCurrentUser();

    if (user?.id == null || user.isGuest) {
      return;
    }

    var roomForm = this.roomForm.value;
    var title = (roomForm?.title ?? '').trim();
    var limits = await this.limitsService.getLimits(user.id);

    var room: Room = {
      title,
      description: roomForm?.description ?? '',
      maxMembers: limits.maxMembers,
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
