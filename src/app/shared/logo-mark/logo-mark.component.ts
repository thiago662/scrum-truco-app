import { Component } from '@angular/core';

// Marca reconstruída em SVG a partir do PNG original (removido, era só o rascunho preto), pra
// poder herdar cor via currentColor — mesmo arquivo serve pra tema claro/escuro e pro verso da carta.
@Component({
  selector: 'app-logo-mark',
  templateUrl: './logo-mark.component.html',
})
export class LogoMarkComponent { }
