import { Component, inject } from '@angular/core';
import { NavService } from '../nav/nav.service';

@Component({
  selector: 'app-room',
  templateUrl: './room.component.html',
  styleUrl: './room.component.scss'
})
export class RoomComponent {
  rooms: any[] = [];

  constructor(
    private navService: NavService,
  ) { }

  async ngOnInit() {
    this.rooms = await this.navService.getUsersRooms();
  }
}
