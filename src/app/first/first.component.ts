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

    // isGuest fica de fora: visitar uma sala sem sessão cria um convidado anônimo de
    // verdade no Firebase Auth (room-view.component.ts, loginAsGuest), e isso não é
    // "ter conta" — sem essa checagem, todo visitante virava "logado" e nunca mais via
    // essa página. Guarda de destroyed: não força redirect por cima de onde a pessoa já está
    // se ela navegou pra outro lugar enquanto a promise resolvia.
    if (user != null && !user.isGuest && !this.destroyed) {
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
