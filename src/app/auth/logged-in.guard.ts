import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

// só conta cadastrada de verdade passa (nunca convidado anônimo, ver AuthService.toUser) --
// protege /rooms e /rooms/add pra quem não devia estar lá nem ver a tela
export const loggedInGuard: CanActivateFn = async () => {
  const platformId = inject(PLATFORM_ID);

  // Firebase Auth nunca resolve durante o prerender SSR (ng build gera as rotas estáticas) --
  // sem essa guarda, o build trava esperando uma Promise que nunca chega. Deixa passar aqui;
  // quem garante o acesso de verdade no navegador é a checagem abaixo, client-side.
  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  const authService = inject(AuthService);
  const router = inject(Router);

  try {
    const user = await authService.getCurrentUser();

    if (user != null && !user.isGuest) {
      return true;
    }
  } catch {
    // getCurrentUser rejeitando (getDoc do perfil falhou, rede instável) não pode travar
    // a navegação com um NavigationError -- trata como "não logado", manda pra raiz
  }

  return router.createUrlTree(['/']);
};
