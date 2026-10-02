import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { environment } from '../../environments/environment';

import { RoomComponent } from './room.component';
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
      roleLabel: '',
      activityLabel: '',
      avatarInitials: [],
      extraMemberCount: 0,
    }];
    component.filterText = 'não existe nenhuma sala com esse nome';
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Nenhuma sala encontrada com esse filtro.');
  });
});
