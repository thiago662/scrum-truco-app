import { Component, OnDestroy, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Unsubscribe } from '@angular/fire/firestore';
import { RoomService } from '../room.service';
import { AuthService } from '../../auth/auth.service';
import { Room, RoomMember } from '../../model/room.model';

type MemberRow = RoomMember & { uid: string };

@Component({
  selector: 'app-room-view',
  templateUrl: './room-view.component.html',
  styleUrl: './room-view.component.scss'
})
export class RoomViewComponent implements OnInit, OnDestroy {
  id: string;
  room: Room | undefined;
  userId: string | undefined;
  members: MemberRow[] = [];
  joinName = '';
  errorMessage = '';

  private unsub?: Unsubscribe;
  private indexState?: string;
  private platformId = inject(PLATFORM_ID);

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private roomService: RoomService,
    private authService: AuthService,
  ) {
    this.id = this.route.snapshot.params['id'];
  }

  async ngOnInit() {
    // Firebase Auth/Firestore nunca resolvem durante o prerender SSR (ng build gera as
    // rotas estáticas) — sem essa guarda, o build trava esperando uma Promise que nunca chega.
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      const user = (await this.authService.getCurrentUser()) ?? (await this.authService.loginAsGuest());
      this.userId = user.id;
      this.joinName = user.name ?? '';
    } catch {
      this.errorMessage = 'Não foi possível entrar como convidado.';
      return;
    }

    this.unsub = this.roomService.listenRoom(this.id, (room) => {
      this.room = room;

      if (room == undefined) {
        this.router.navigate(['/rooms/']);
        return;
      }

      this.members = Object.keys(room.members ?? {}).map((uid) => ({
        uid,
        ...room.members![uid],
      }));

      this.syncUserIndex();
    });
  }

  // users/{uid}/rooms é só cache de "minhas salas": só escrito pelo próprio usuário (rules),
  // então o vínculo é criado ao ser aprovado e removido ao perder a vaga.
  private async syncUserIndex() {
    const state = this.myMember?.status ?? 'none';

    if (this.userId == null || state === this.indexState || state === 'pending') {
      return;
    }

    this.indexState = state;

    try {
      if (state === 'approved') {
        await this.roomService.addToUserIndex(this.userId, this.id, this.room?.title ?? '');
      } else {
        await this.roomService.removeFromUserIndex(this.userId, this.id);
      }
    } catch {
      this.indexState = undefined;
    }
  }

  ngOnDestroy() {
    this.unsub?.();
  }

  get isOwner(): boolean {
    return this.userId != null && this.userId === this.room?.ownerId;
  }

  get myMember(): MemberRow | undefined {
    return this.members.find((member) => member.uid === this.userId);
  }

  get approvedMembers(): MemberRow[] {
    return this.members.filter((member) => member.status === 'approved');
  }

  get pendingMembers(): MemberRow[] {
    return this.members.filter((member) => member.status === 'pending');
  }

  private async attempt(action: () => Promise<void>, message: string) {
    this.errorMessage = '';

    try {
      await action();
    } catch {
      this.errorMessage = message;
    }
  }

  async requestJoin() {
    const name = this.joinName.trim();

    if (this.userId == null || name === '') {
      return;
    }

    await this.attempt(() => this.roomService.requestJoin(this.id, this.userId!, name), 'Não foi possível pedir entrada na sala.');
  }

  async approveMember(uid: string) {
    await this.attempt(() => this.roomService.approveMember(this.id, uid), 'Não foi possível aprovar o participante.');
  }

  async removeMember(uid: string) {
    await this.attempt(() => this.roomService.removeMember(this.id, uid), 'Não foi possível remover o participante.');
  }

  async changeController(controllerId: string) {
    await this.attempt(() => this.roomService.updateControllerId(this.id, controllerId), 'Não foi possível trocar o controlador.');
  }

  async closeRoom() {
    await this.attempt(() => this.roomService.closeRoom(this.id), 'Não foi possível encerrar a sala.');
  }
}
