import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FirstComponent } from './first/first.component';
import { RoomComponent } from './room/room.component';
import { RoomViewComponent } from './room/room-view/room-view.component';
import { RoomSearchComponent } from './room/room-search/room-search.component';
import { RoomAddComponent } from './room/room-add/room-add.component';

const routes: Routes = [
  {
    path: '',
    component: FirstComponent,
  },
  {
    path: 'rooms',
    component: RoomComponent,
  },
  {
    path: 'rooms/search',
    component: RoomSearchComponent,
  },
  {
    path: 'rooms/add',
    component: RoomAddComponent,
  },
  {
    path: 'rooms/:id',
    component: RoomViewComponent,
  },
  // {
  //   path: 'users',
  //   component: anyComponent,
  //   children: [
  //     { path: ':id', component: anyModalComponent },
  //   ],
  // },
  // {
  //   path: 'animals',
  //   component: AnimalComponent,
  // },
  // {
  //   path: 'animals/:id',
  //   component: AnimalViewComponent,
  // },
  {
    path: '**',
    redirectTo: '',
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
