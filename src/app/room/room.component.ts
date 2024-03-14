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
    var roomsObject: any[] = await this.navService.getUsersRooms();

    const rooms: any[] = await Object.keys(roomsObject);

    let arrayUsers: any[] = await [];

    for (let indexUserId = 0; indexUserId < rooms.length; indexUserId++) {
      arrayUsers.push(roomsObject[rooms[indexUserId]]);
    }

    this.rooms = await arrayUsers;
  }
}
