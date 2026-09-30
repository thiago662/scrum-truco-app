import { Component, OnDestroy, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import { RoomService, toMillis } from './room.service';
import { AuthService } from '../auth/auth.service';
import { Room } from '../model/room.model';

const MAX_AVATARS = 3;

type RoomCard = {
  id: string;
  title: string;
  status: 'open' | 'closed';
  roleLabel: string;
  activityLabel: string;
  avatarInitials: string[];
  extraMemberCount: number;
};

// Intl nativo em vez de lib de datas, só pra "há X min/h/dias" nos cards da dashboard.
function relativeLabel(value: any): string {
  const ms = toMillis(value);
  if (ms == null) {
    return '';
  }

  // sempre passado (é lastActivityAt) — min 0 pra não ler "em X segundos" por deriva de
  // relógio entre o servidor (serverTimestamp) e a máquina do cliente
  const diffSec = Math.min(0, Math.round((ms - Date.now()) / 1000));
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

  // trunc (não round) ao converter pra minuto/hora/dia: arredondar deixaria 59min59s virar
  // "60 minutos" em vez de rolar pra "1 hora" (mesmo problema em qualquer fronteira de unidade)
  if (abs < 60) return rtf.format(diffSec, 'second');
  if (abs < 3600) return rtf.format(Math.trunc(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.trunc(diffSec / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.trunc(diffSec / 86400), 'day');
  return rtf.format(Math.trunc(diffSec / (86400 * 30)), 'month');
}

function toCard(room: Room, myUid: string): RoomCard {
  const members = Object.entries(room.members ?? {});
  const approved = members.filter(([, member]) => member.status === 'approved');

  let roleLabel = '';
  if (room.ownerId === myUid) {
    roleLabel = 'Você é o dono';
  } else if (room.controllerId === myUid) {
    roleLabel = 'Você é o controlador';
  } else {
    const controllerName = room.members?.[room.controllerId ?? '']?.name;
    roleLabel = controllerName ? `Controlador: ${controllerName}` : '';
  }

  const avatarInitials = approved.slice(0, MAX_AVATARS).map(([, member]) => member.name?.charAt(0).toUpperCase() || '?');

  return {
    id: room.id!,
    title: room.title || '(sem título)',
    status: room.status === 'closed' ? 'closed' : 'open',
    roleLabel,
    activityLabel: relativeLabel(room.lastActivityAt),
    avatarInitials,
    extraMemberCount: Math.max(0, approved.length - MAX_AVATARS),
  };
}

@Component({
  selector: 'app-room',
  templateUrl: './room.component.html',
  styleUrl: './room.component.scss'
})
export class RoomComponent implements OnInit, OnDestroy {
  cards: RoomCard[] = [];
  loaded = false;
  filterText = '';

  private roomsSub?: Subscription;
  private platformId = inject(PLATFORM_ID);
  // incrementado a cada emissão do índice; uma resolução de getRoom só aplica se ainda for
  // a mais recente — sem isso, uma emissão mais lenta pode sobrescrever dado mais novo (e,
  // depois do ngOnDestroy, escrever em cards de um componente já destruído)
  private requestToken = 0;

  constructor(
    private roomService: RoomService,
    private authService: AuthService,
  ) { }

  async ngOnInit() {
    // Firebase Auth nunca resolve durante o prerender SSR (ng build gera as rotas
    // estáticas) — sem essa guarda, o build trava esperando uma Promise que nunca chega.
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const user = await this.authService.getCurrentUser();

    if (user?.id == null) {
      return;
    }

    const myUid = user.id;

    // ponytail: refaz o getRoom de toda sala a cada emissão do índice, mesmo que só uma tenha
    // mudado — poucas dezenas de leitura por usuário, bem dentro do Spark. Cachear por
    // roomId só se a lista de salas por usuário crescer de verdade.
    this.roomsSub = this.roomService.getUserRooms(myUid).subscribe(async (entries) => {
      const token = ++this.requestToken;
      const rooms = await Promise.all(entries.map((entry) => this.roomService.getRoom(entry.roomId)));

      if (token !== this.requestToken) {
        return;
      }

      this.cards = rooms
        .filter((room): room is Room => room != null)
        .map((room) => toCard(room, myUid));
      this.loaded = true;
    });
  }

  ngOnDestroy() {
    this.roomsSub?.unsubscribe();
    this.requestToken++;
  }

  get filteredCards(): RoomCard[] {
    const term = this.filterText.trim().toLowerCase();

    if (!term) {
      return this.cards;
    }

    return this.cards.filter((card) => card.title.toLowerCase().includes(term));
  }
}
