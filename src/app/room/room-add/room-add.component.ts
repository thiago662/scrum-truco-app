import { Component, inject } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { ActivatedRoute, Router} from '@angular/router';
import { RoomService } from '../room.service';
import { NavService } from '../../nav/nav.service';

@Component({
  selector: 'app-room-add',
  templateUrl: './room-add.component.html',
  styleUrl: './room-add.component.scss'
})
export class RoomAddComponent {
  points = [
    {
      value: '?',
      selected: false
    },
    {
      value: '0',
      selected: false
    },
    {
      value: '1',
      selected: false
    },
    {
      value: '2',
      selected: false
    },
    {
      value: '3',
      selected: false
    },
    {
      value: '5',
      selected: false
    },
    {
      value: '8',
      selected: false
    },
    {
      value: '13',
      selected: false
    },
    {
      value: '21',
      selected: false
    },
    {
      value: '34',
      selected: false
    },
    {
      value: '55',
      selected: false
    },
    {
      value: '89',
      selected: false
    },
  ];
  roomForm = new FormGroup({
    id: new FormControl(''),
    title: new FormControl(''),
    description: new FormControl(''),
  });
  user: any;

  constructor(
    private roomService: RoomService,
    private navService: NavService,
    private route: ActivatedRoute,
    private router: Router,
  ) {
    this.getUser();
  }

  async createRoom() {
    var roomForm = await this.roomForm.value;

    var room: any = await {
      title: roomForm?.title ?? '',
      description: roomForm?.description ?? '',
      isVisible: false,
      users: {},
    };
    room.users[this.user?.id] = await {
      'id': this.user?.id,
      'name': this.user?.name,
      'isAdm': true,
      'selected': false,
      'value': '',
    };

    var roomFirebase: any = await this.roomService.createRoom(room);

    await this.updateUser(roomFirebase);

    await this.router.navigate(['/rooms/' + roomFirebase?.id]);
  }

  async updateUser(room: any) {
    var user: any = await this.navService.getUser();

    await user.rooms.push({
      id: room?.id ?? '',
      title: room?.title ?? '',
      description: room?.description ?? '',
    });

    await this.navService.updateUser(user?.id, user);
  }

  async getUser() {
    var user: any = await this.navService.getUser();

    this.user = await user;
  }
}
