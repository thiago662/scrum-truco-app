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
  // checado no envio (e não ao abrir a tela): a contagem é lida na hora, então não fica velha
  limitReached = false;
  maxActiveRooms = 0;
  activeRoomsCount = 0;
  createError = false;

  async createRoom() {
    // lê usuário e limites antes de criar: sem a trava, um clique duplo nessa janela criaria duas salas
    if (this.creating) {
      return;
    }

    this.creating = true;
    this.createError = false;

    try {
      await this.doCreateRoom();
    } catch {
      // falha de leitura/escrita (offline, rules): sem isto o botão só pararia de responder
      this.createError = true;
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

    // o dashboard já trava o botão no limite; isto cobre acesso direto pela URL e contagem velha
    this.activeRoomsCount = limits.unlimited ? 0 : (await this.roomService.getOwnedOpenRooms(user.id)).length;
    this.maxActiveRooms = limits.maxActiveRooms;
    this.limitReached = this.activeRoomsCount >= limits.maxActiveRooms;

    if (this.limitReached) {
      return;
    }

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
