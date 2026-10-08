import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { environment } from '../../../environments/environment';

import { Router } from '@angular/router';
import { RoomAddComponent } from './room-add.component';
import { RoomService } from '../room.service';
import { LimitsService, Limits } from '../limits.service';
import { AuthService } from '../../auth/auth.service';

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

  describe('teto de salas ativas', () => {
    function setup(limits: Limits, openRooms: number) {
      component.roomForm.setValue({ title: 'Sala nova', description: '' });
      spyOn(TestBed.inject(AuthService), 'getCurrentUser').and.resolveTo({ id: 'u1', isGuest: false } as any);
      spyOn(TestBed.inject(LimitsService), 'getLimits').and.resolveTo(limits);
      const owned = spyOn(TestBed.inject(RoomService), 'getOwnedOpenRooms').and.resolveTo(new Array(openRooms).fill({}));
      const create = spyOn(TestBed.inject(RoomService), 'createRoom').and.resolveTo('novaId');
      spyOn(TestBed.inject(RoomService), 'addToUserIndex').and.resolveTo();
      spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      return { owned, create };
    }

    it('no limite, não cria e mostra o aviso', async () => {
      const { create } = setup({ maxActiveRooms: 2, maxMembers: 8, unlimited: false }, 2);

      await component.createRoom();
      fixture.detectChanges();

      expect(create).not.toHaveBeenCalled();
      expect(component.limitReached).toBeTrue();
      expect(fixture.nativeElement.querySelector('#limitReached').textContent).toContain('Você já tem 2 salas ativas e o limite é 2');
    });

    it('o aviso mostra a contagem real, não o limite (limite baixou com sala sobrando)', async () => {
      setup({ maxActiveRooms: 3, maxMembers: 8, unlimited: false }, 7);

      await component.createRoom();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('#limitReached').textContent).toContain('Você já tem 7 salas ativas e o limite é 3');
    });

    it('se ler as salas falhar, avisa em vez de ficar parado, e não cria', async () => {
      const { create } = setup({ maxActiveRooms: 2, maxMembers: 8, unlimited: false }, 0);
      (TestBed.inject(RoomService).getOwnedOpenRooms as jasmine.Spy).and.rejectWith(new Error('offline'));

      await component.createRoom();
      fixture.detectChanges();

      expect(create).not.toHaveBeenCalled();
      expect(component.creating).toBeFalse();
      expect(fixture.nativeElement.querySelector('#createError')).toBeTruthy();
    });

    it('abaixo do limite, cria normalmente', async () => {
      const { create } = setup({ maxActiveRooms: 2, maxMembers: 8, unlimited: false }, 1);

      await component.createRoom();

      expect(create).toHaveBeenCalledTimes(1);
      expect(component.limitReached).toBeFalse();
    });

    it('conta unlimited cria sem nem consultar as salas abertas', async () => {
      const { owned, create } = setup({ maxActiveRooms: Infinity, maxMembers: 1000, unlimited: true }, 50);

      await component.createRoom();

      expect(owned).not.toHaveBeenCalled();
      expect(create).toHaveBeenCalledTimes(1);
    });

    it('depois de encerrar uma sala, tentar de novo limpa o aviso', async () => {
      const { create } = setup({ maxActiveRooms: 2, maxMembers: 8, unlimited: false }, 2);
      await component.createRoom();
      expect(component.limitReached).toBeTrue();

      (TestBed.inject(RoomService).getOwnedOpenRooms as jasmine.Spy).and.resolveTo([{}]);
      await component.createRoom();

      expect(component.limitReached).toBeFalse();
      expect(create).toHaveBeenCalledTimes(1);
    });
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
