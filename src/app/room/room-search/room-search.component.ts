import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { RoomService } from '../room.service';
import { Room } from '../../model/room.model';

@Component({
  selector: 'app-room-search',
  templateUrl: './room-search.component.html',
  styleUrl: './room-search.component.scss'
})
export class RoomSearchComponent {
  id = '';
  room: Room | undefined;

  constructor(
    private router: Router,
    private roomService: RoomService,
  ) { }

  async findClass() {
    this.room = await this.roomService.getRoom(this.id);

    if (this.room != undefined) {
      this.router.navigate(['/rooms/' + this.id]);
    }
  }
}
