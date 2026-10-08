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
import { Round } from '../../model/round.model';
import { POINTING_TYPES } from '../pointing-types';

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

  it('isGuest comeca true por padrao -- so vira false depois que ngOnInit confirma', () => {
    expect(component.isGuest).toBeTrue();
  });

  it('mostra o breadcrumb pra quem está logado, mas nao pra convidado', () => {
    const room = new Room('r1', 'Sala');
    room.status = 'open';
    room.ownerId = 'uid1';
    component.room = room;
    component.userId = 'uid1';
    component.members = [{ uid: 'uid1', name: 'Fulano', role: 'owner', status: 'approved' }];
    component.round = undefined;

    component.isGuest = false;
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.breadcrumb'))).toBeTruthy();

    component.isGuest = true;
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.breadcrumb'))).toBeFalsy();
  });

  function roomWithMembers(count: number, maxMembers?: number): Room {
    const room = new Room('r1', 'Sala');
    room.status = 'open';
    room.ownerId = 'owner';
    room.maxMembers = maxMembers;
    component.room = room;
    component.userId = 'visitor';
    component.members = Array.from({ length: count }, (_, i) => ({
      uid: `u${i}`, name: `Pessoa ${i}`, role: (i === 0 ? 'owner' : 'member') as 'owner' | 'member', status: 'approved' as const,
    }));
    return room;
  }

  it('mostra "sala cheia" no lugar do pedido de entrada quando members chegou em maxMembers', () => {
    roomWithMembers(3, 3);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('#roomFull'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('#joinName'))).toBeFalsy();
  });

  it('com vaga sobrando, mostra o formulário de pedido de entrada', () => {
    roomWithMembers(2, 3);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('#roomFull'))).toBeFalsy();
    expect(fixture.debugElement.query(By.css('#joinName'))).toBeTruthy();
  });

  it('sala sem maxMembers (anterior aos limites) usa o padrão de 8', () => {
    roomWithMembers(8);
    expect(component.maxMembers).toBe(8);
    expect(component.isFull).toBeTrue();

    roomWithMembers(7);
    expect(component.isFull).toBeFalse();
  });

  function fibonacciRound(): Round {
    return {
      text: 'Pauta', pointingType: POINTING_TYPES[0], startedBy: 'uid1',
      revealed: true, voters: {},
    };
  }

  it('agreementLabel conta quantos votaram igual ao valor mais votado', () => {
    component.round = fibonacciRound();
    component.votes = { a: { value: '5' }, b: { value: '5' }, c: { value: '8' } };
    expect(component.agreementLabel).toBe('67% (2 de 3)');
  });

  it('agreementLabel mostra "sem maioria" em empate entre valores mais votados', () => {
    component.round = fibonacciRound();
    component.votes = { a: { value: '5' }, b: { value: '8' } };
    expect(component.agreementLabel).toBe('sem maioria');
  });

  it('agreementLabel é "—" sem votos carregados', () => {
    component.round = fibonacciRound();
    component.votes = undefined;
    expect(component.agreementLabel).toBe('—');
  });

  it('finalDiffText mostra a diferença entre o valor final decidido e a média calculada', () => {
    component.round = fibonacciRound();
    component.votes = { a: { value: '5' }, b: { value: '8' } };
    // média = 6.5; decide "8" -> diferença +1.5
    component.round.finalValue = '8';
    expect(component.finalDiffText).toBe('+1.5 em relação à média');
  });

  it('finalDiffText é null sem valor final decidido', () => {
    component.round = fibonacciRound();
    component.votes = { a: { value: '5' } };
    expect(component.finalDiffText).toBeNull();
  });
});
