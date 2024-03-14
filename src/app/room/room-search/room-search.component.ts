import { Component } from '@angular/core';
import { ActivatedRoute, Router} from '@angular/router';
import { RoomService } from '../room.service';
import { NavService } from '../../nav/nav.service';

@Component({
  selector: 'app-room-search',
  templateUrl: './room-search.component.html',
  styleUrl: './room-search.component.scss'
})
export class RoomSearchComponent {
  id: any;
  room: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private navService: NavService,
    private roomService: RoomService,
  ) { }

  async findClass() {
    this.room = await this.roomService.getRoom(this.id);

    if (this.room != undefined) {
      this.router.navigate(['/rooms/' + this.id]);
    }
  }
}
