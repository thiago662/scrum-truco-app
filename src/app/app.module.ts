import { NgModule } from '@angular/core';
import { BrowserModule, provideClientHydration } from '@angular/platform-browser';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { provideFirebaseApp, getApp, initializeApp } from '@angular/fire/app';
import { connectFirestoreEmulator, getFirestore, provideFirestore } from '@angular/fire/firestore';
import { connectAuthEmulator, getAuth, provideAuth } from '@angular/fire/auth';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { environment } from '../environments/environment';
import { NavComponent } from './nav/nav.component';
import { FirstComponent } from './first/first.component';
import { RoomComponent } from './room/room.component';
import { RoomViewComponent } from './room/room-view/room-view.component';
import { RoomSearchComponent } from './room/room-search/room-search.component';
import { RoomAddComponent } from './room/room-add/room-add.component';
import { PointingTypePickerComponent } from './room/pointing-type-picker/pointing-type-picker.component';
import { RoundControlComponent } from './room/round-control/round-control.component';
import { LogoMarkComponent } from './shared/logo-mark/logo-mark.component';
import { PlayingCardComponent } from './shared/playing-card/playing-card.component';

@NgModule({
  declarations: [
    AppComponent,
    NavComponent,
    FirstComponent,
    RoomComponent,
    RoomViewComponent,
    RoomSearchComponent,
    RoomAddComponent,
    PointingTypePickerComponent,
    RoundControlComponent,
    LogoMarkComponent,
    PlayingCardComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    NgbModule,
    FormsModule,
    ReactiveFormsModule,
  ],
  providers: [
    provideClientHydration(),
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    // portas de firebase.json; só no ambiente "emulator" (npm run start:emulator)
    provideFirestore(() => {
      const firestore = getFirestore();
      if (environment.useEmulators) {
        connectFirestoreEmulator(firestore, 'localhost', 8080);
      }
      return firestore;
    }),
    provideAuth(() => {
      const auth = getAuth();
      if (environment.useEmulators) {
        connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
      }
      return auth;
    }),
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
