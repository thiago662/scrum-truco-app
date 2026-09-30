import { Component, OnDestroy, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { AuthModalService } from '../auth/auth-modal.service';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-first',
  templateUrl: './first.component.html',
  styleUrl: './first.component.scss'
})
export class FirstComponent implements OnInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private destroyed = false;

  constructor(
    private authModalService: AuthModalService,
    private authService: AuthService,
    private router: Router,
  ) { }

  async ngOnInit() {
    // Firebase Auth nunca resolve durante o prerender SSR (ng build gera as rotas
    // estáticas) — sem essa guarda, o build trava esperando uma Promise que nunca chega.
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const user = await this.authService.getCurrentUser();

    // se o componente já foi destruído (usuário navegou pra outro lugar enquanto a
    // promise resolvia), não força redirect por cima de onde a pessoa já está
    if (user != null && !this.destroyed) {
      this.router.navigate(['/rooms']);
    }
  }

  ngOnDestroy() {
    this.destroyed = true;
  }

  openLogin() {
    this.authModalService.open('login');
  }

  openRegister() {
    this.authModalService.open('create');
  }
}
