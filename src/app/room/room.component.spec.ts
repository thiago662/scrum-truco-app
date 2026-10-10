import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { environment } from '../../environments/environment';

import { RoomComponent } from './room.component';
import { RoomService } from './room.service';
import { Limits } from './limits.service';
import { LogoMarkComponent } from '../shared/logo-mark/logo-mark.component';

describe('RoomComponent', () => {
  let component: RoomComponent;
  let fixture: ComponentFixture<RoomComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RoomComponent, LogoMarkComponent],
      imports: [RouterTestingModule, FormsModule],
      providers: [
        provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
        provideFirestore(() => getFirestore()),
        provideAuth(() => getAuth()),
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(RoomComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('não mostra o estado vazio quando a carga falhou (loadError)', () => {
    component.loaded = true;
    component.loadError = true;
    component.cards = [];
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Não foi possível carregar suas salas agora.');
    expect(text).not.toContain('Nenhuma sala ainda');
  });

  it('avisa quando o filtro não encontra nenhuma sala', () => {
    component.loaded = true;
    component.loadError = false;
    component.cards = [{
      id: 'abc',
      title: 'Sprint 1',
      status: 'open',
      isOwner: true,
      roleLabel: '',
      activityLabel: '',
      avatarInitials: [],
      extraMemberCount: 0,
    }];
    component.filterText = 'não existe nenhuma sala com esse nome';
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Nenhuma sala encontrada com esse filtro.');
  });

  describe('teto de salas ativas', () => {
    const card = (id: string, status: 'open' | 'closed', isOwner: boolean) => ({
      id, title: `Sala ${id}`, status, isOwner, roleLabel: '', activityLabel: '', avatarInitials: [], extraMemberCount: 0,
    });
    const limits = (maxActiveRooms: number): Limits => ({ maxActiveRooms, maxMembers: 8, unlimited: false });

    // 2 abertas minhas + 1 encerrada minha + 1 aberta em que só participo: só as 2 primeiras contam
    function setup(max: Limits) {
      component.loaded = true;
      component.cards = [card('a', 'open', true), card('b', 'open', true), card('c', 'closed', true), card('d', 'open', false)];
      component.limits = max;
      fixture.detectChanges();
    }

    const newRoomButton = () => fixture.nativeElement.querySelector('#newRoom') as HTMLElement;
    // no limite vira um <button disabled> de verdade; fora dele é o link pra criar sala
    const isLocked = () => newRoomButton().tagName === 'BUTTON' && (newRoomButton() as HTMLButtonElement).disabled;

    it('conta só as salas abertas que eu criei', () => {
      setup(limits(5));

      expect(component.ownedOpenCards.map((c) => c.id)).toEqual(['a', 'b']);
      expect(fixture.nativeElement.querySelector('#activeCounter').textContent).toContain('2 de 5 salas ativas');
    });

    it('abaixo do limite, não trava o botão nem mostra o aviso', () => {
      setup(limits(5));

      expect(fixture.nativeElement.querySelector('#limitAlert')).toBeNull();
      expect(isLocked()).toBeFalse();
      expect(newRoomButton().tagName).toBe('A');
    });

    it('no limite, trava "+ Nova sala" e lista só as minhas abertas pra encerrar', () => {
      setup(limits(2));

      expect(isLocked()).toBeTrue();
      const listed = Array.from(fixture.nativeElement.querySelectorAll('#limitAlert li a')).map((a: any) => a.textContent.trim());
      expect(listed).toEqual(['Sala a', 'Sala b']);
    });

    it('antes de carregar os limites, não mostra contador nem trava nada', () => {
      setup(limits(2));
      component.limits = null;
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('#activeCounter')).toBeNull();
      expect(component.atLimit).toBeFalse();
    });

    it('conta unlimited não vê contador nem aviso', () => {
      setup({ maxActiveRooms: Infinity, maxMembers: 1000, unlimited: true });

      expect(fixture.nativeElement.querySelector('#activeCounter')).toBeNull();
      expect(fixture.nativeElement.querySelector('#limitAlert')).toBeNull();
      expect(isLocked()).toBeFalse();
    });

    it('encerrar uma sala pelo aviso libera o botão', async () => {
      setup(limits(2));
      const close = spyOn(TestBed.inject(RoomService), 'closeRoom').and.resolveTo();

      await component.closeRoom(component.cards[0]);
      fixture.detectChanges();

      expect(close).toHaveBeenCalledWith('a');
      expect(component.atLimit).toBeFalse();
      expect(fixture.nativeElement.querySelector('#limitAlert')).toBeNull();
      expect(isLocked()).toBeFalse();
      expect(newRoomButton().tagName).toBe('A');
    });

    it('encerrar invalida um carregamento em voo (que traria a sala ainda aberta)', async () => {
      setup(limits(2));
      spyOn(TestBed.inject(RoomService), 'closeRoom').and.resolveTo();
      const tokenBefore = (component as any).requestToken;

      await component.closeRoom(component.cards[0]);

      expect((component as any).requestToken).toBeGreaterThan(tokenBefore);
    });

    it('se encerrar falhar, mantém o limite e mostra o erro', async () => {
      setup(limits(2));
      spyOn(TestBed.inject(RoomService), 'closeRoom').and.rejectWith(new Error('negado'));

      await component.closeRoom(component.cards[0]);
      fixture.detectChanges();

      expect(component.atLimit).toBeTrue();
      expect(fixture.nativeElement.textContent).toContain('Não foi possível encerrar a sala agora.');
      expect(component.closingId).toBeNull();
    });
  });
});
