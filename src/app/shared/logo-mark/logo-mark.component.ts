import { Component } from '@angular/core';

// Marca reconstruída em SVG a partir do PNG original (removido, era só o rascunho preto), pra
// poder herdar cor via currentColor — mesmo arquivo serve pra tema claro/escuro e pro verso da carta.
@Component({
  selector: 'app-logo-mark',
  templateUrl: './logo-mark.component.html',
  // elemento customizado sem isso fica display:inline (padrão do navegador pra tag
  // desconhecida) -- width/height setado por fora é ignorado em inline não-substituído,
  // e o svg interno (width/height 100%) perde a referência de tamanho e renderiza enorme.
  // Só não dava pra notar até agora porque todo uso anterior calhava de ter um pai
  // display:flex, que blockifica o item automaticamente (menu, verso da carta).
  styles: [':host { display: block; }'],
})
export class LogoMarkComponent { }
