import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LogoMarkComponent } from './logo-mark.component';

describe('LogoMarkComponent', () => {
  let component: LogoMarkComponent;
  let fixture: ComponentFixture<LogoMarkComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LogoMarkComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LogoMarkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renderiza os 5 losangos do svg', () => {
    const polygons = fixture.nativeElement.querySelectorAll('polygon');
    expect(polygons.length).toBe(5);
  });
});
