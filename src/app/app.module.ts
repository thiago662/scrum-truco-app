import { NgModule } from '@angular/core';
import { BrowserModule, provideClientHydration } from '@angular/platform-browser';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { provideFirebaseApp, getApp, initializeApp } from '@angular/fire/app';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { environment } from '../environments/environment';
import { NavComponent } from './nav/nav.component';
import { FirstComponent } from './first/first.component';
import { RoomComponent } from './room/room.component';
import { RoomViewComponent } from './room/room-view/room-view.component';
import { RoomSearchComponent } from './room/room-search/room-search.component';
import { RoomAddComponent } from './room/room-add/room-add.component';

@NgModule({
  declarations: [
    AppComponent,
    NavComponent,
    FirstComponent,
    RoomComponent,
    RoomViewComponent,
    RoomSearchComponent,
    RoomAddComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    NgbModule,
    FormsModule,
    ReactiveFormsModule,
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    provideFirestore(() => getFirestore()),
  ],
  providers: [
    provideClientHydration()
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
