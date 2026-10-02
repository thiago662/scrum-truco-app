import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FirstComponent } from './first.component';
import { LogoMarkComponent } from '../shared/logo-mark/logo-mark.component';
import { PlayingCardComponent } from '../shared/playing-card/playing-card.component';

describe('FirstComponent', () => {
  let component: FirstComponent;
  let fixture: ComponentFixture<FirstComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FirstComponent, LogoMarkComponent, PlayingCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FirstComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
