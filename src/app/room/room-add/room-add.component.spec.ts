import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { environment } from '../../../environments/environment';

import { RoomAddComponent } from './room-add.component';

describe('RoomAddComponent', () => {
  let component: RoomAddComponent;
  let fixture: ComponentFixture<RoomAddComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RoomAddComponent],
      imports: [RouterTestingModule, ReactiveFormsModule],
      providers: [
        provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
        provideFirestore(() => getFirestore()),
        provideAuth(() => getAuth()),
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(RoomAddComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('createRoom ignora o segundo clique enquanto o primeiro não terminou', async () => {
    let release!: () => void;
    const doCreate = spyOn<any>(component, 'doCreateRoom').and.returnValue(new Promise<void>((resolve) => release = resolve));

    const first = component.createRoom();
    await component.createRoom();

    expect(doCreate).toHaveBeenCalledTimes(1);
    expect(component.creating).toBeTrue();

    release();
    await first;
    expect(component.creating).toBeFalse();
  });
});
