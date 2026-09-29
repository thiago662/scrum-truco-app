import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlayingCardComponent } from './playing-card.component';
import { LogoMarkComponent } from '../logo-mark/logo-mark.component';

describe('PlayingCardComponent', () => {
  let component: PlayingCardComponent;
  let fixture: ComponentFixture<PlayingCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PlayingCardComponent, LogoMarkComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PlayingCardComponent);
    component = fixture.componentInstance;
  });

  it('mostra o rótulo na frente e esconde o verso da acessibilidade', () => {
    component.label = '8';
    component.face = 'front';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.playing-card__label').textContent.trim()).toBe('8');
    expect(fixture.nativeElement.querySelector('.playing-card__inner').classList).not.toContain('playing-card__inner--flipped');
    expect(fixture.nativeElement.querySelector('.playing-card__face--back').getAttribute('aria-hidden')).toBe('true');
    expect(fixture.nativeElement.querySelector('.playing-card__face--front').getAttribute('aria-hidden')).toBeNull();
  });

  it('vira pro verso e esconde a frente da acessibilidade', () => {
    component.label = '8';
    component.face = 'back';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-logo-mark')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.playing-card__inner').classList).toContain('playing-card__inner--flipped');
    expect(fixture.nativeElement.querySelector('.playing-card__face--front').getAttribute('aria-hidden')).toBe('true');
    expect(fixture.nativeElement.querySelector('.playing-card__face--back').getAttribute('aria-hidden')).toBeNull();
  });

  it('aplica a classe de selecionada', () => {
    component.selected = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.playing-card').classList).toContain('playing-card--selected');
  });
});
