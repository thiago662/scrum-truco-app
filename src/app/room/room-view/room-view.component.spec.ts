import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule } from '@angular/forms';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { environment } from '../../../environments/environment';

import { RoomViewComponent } from './room-view.component';
import { RoundControlComponent } from '../round-control/round-control.component';
import { PointingTypePickerComponent } from '../pointing-type-picker/pointing-type-picker.component';
import { PlayingCardComponent } from '../../shared/playing-card/playing-card.component';
import { LogoMarkComponent } from '../../shared/logo-mark/logo-mark.component';
import { Room } from '../../model/room.model';

describe('RoomViewComponent', () => {
  let component: RoomViewComponent;
  let fixture: ComponentFixture<RoomViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RoomViewComponent, RoundControlComponent, PointingTypePickerComponent, PlayingCardComponent, LogoMarkComponent],
      imports: [RouterTestingModule, FormsModule],
      providers: [
        provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
        provideFirestore(() => getFirestore()),
        provideAuth(() => getAuth()),
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(RoomViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('copyLink copia o endereço atual e sinaliza; se o clipboard falhar, avisa', async () => {
    const writeText = spyOn(navigator.clipboard, 'writeText').and.resolveTo();

    await component.copyLink();
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(component.linkCopied).toBeTrue();

    writeText.and.rejectWith(new Error('negado'));
    await component.copyLink();
    expect(component.errorMessage).toContain('Copie o endereço');
  });

  it('reserva o espaço do card no assento mesmo sem rodada em andamento', () => {
    const room = new Room('r1', 'Sala');
    room.status = 'open';
    room.ownerId = 'uid1';
    component.room = room;
    component.userId = 'uid1';
    component.members = [{ uid: 'uid1', name: 'Fulano', role: 'owner', status: 'approved' }];
    component.round = undefined;
    fixture.detectChanges();

    const card = fixture.debugElement.query(By.css('.seat app-playing-card'))?.componentInstance as PlayingCardComponent;
    expect(card).toBeTruthy();
    expect(card.face).toBe('empty');
  });
});
