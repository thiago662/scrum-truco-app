import { Component, OnDestroy, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import { RoomService } from './room.service';
import { AuthService } from '../auth/auth.service';
import { RoomIndexEntry } from '../model/room.model';

@Component({
  selector: 'app-room',
  templateUrl: './room.component.html',
  styleUrl: './room.component.scss'
})
export class RoomComponent implements OnInit, OnDestroy {
  rooms: RoomIndexEntry[] = [];

  private roomsSub?: Subscription;
  private platformId = inject(PLATFORM_ID);

  constructor(
    private roomService: RoomService,
    private authService: AuthService,
  ) { }

  async ngOnInit() {
    // Firebase Auth nunca resolve durante o prerender SSR (ng build gera as rotas
    // estáticas) — sem essa guarda, o build trava esperando uma Promise que nunca chega.
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    var user = await this.authService.getCurrentUser();

    if (user?.id == null) {
      return;
    }

    this.roomsSub = this.roomService.getUserRooms(user.id).subscribe((rooms) => {
      this.rooms = rooms;
    });
  }

  ngOnDestroy() {
    this.roomsSub?.unsubscribe();
  }
}
