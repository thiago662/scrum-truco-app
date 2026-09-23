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

  private unsub?: Unsubscribe;
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

    const user = await this.authService.getCurrentUser();
    this.userId = user?.id;

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
    });
  }

  ngOnDestroy() {
    this.unsub?.();
  }

  get isOwner(): boolean {
    return this.userId != null && this.userId === this.room?.ownerId;
  }

  get approvedMembers(): MemberRow[] {
    return this.members.filter((member) => member.status === 'approved');
  }

  async changeController(controllerId: string) {
    await this.roomService.updateControllerId(this.id, controllerId);
  }

  async closeRoom() {
    await this.roomService.closeRoom(this.id);
  }
}
