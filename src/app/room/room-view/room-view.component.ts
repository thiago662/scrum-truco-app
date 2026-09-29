import { Component, OnDestroy, OnInit, PLATFORM_ID, ViewChild, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Unsubscribe } from '@angular/fire/firestore';
import { RoomService, STALE_CHECK_INTERVAL_MS } from '../room.service';
import { RoundService } from '../round.service';
import { AuthService } from '../../auth/auth.service';
import { Room, RoomMember } from '../../model/room.model';
import { Round, Vote } from '../../model/round.model';
import { PointingOption, PointingType } from '../../model/pointing-type.model';
import { averageWeight, nearestOption, weightOf } from '../pointing-types';
import { RoundControlComponent } from '../round-control/round-control.component';

type MemberRow = RoomMember & { uid: string };

// acima disso a mesa fica pequena/apertada demais (cartão+nome de cada assento não cabe
// nas bordas); cai pra grade normal, que sempre coube, só não parece "mesa"
const MAX_TABLE_SEATS = 12;

type SeatEdges = { top: MemberRow[]; left: MemberRow[]; right: MemberRow[]; bottom: MemberRow[] };
const EDGE_CYCLE: (keyof SeatEdges)[] = ['top', 'bottom', 'left', 'right'];

@Component({
  selector: 'app-room-view',
  templateUrl: './room-view.component.html',
  styleUrl: './room-view.component.scss'
})
export class RoomViewComponent implements OnInit, OnDestroy {
  id: string;
  room: Room | undefined;
  userId: string | undefined;
  members: MemberRow[] = [];
  joinName = '';
  errorMessage = '';

  round: Round | undefined;
  myVote: Vote | undefined;
  votes: { [uid: string]: Vote } | undefined;
  startingRound = false;
  linkCopied = false;

  @ViewChild(RoundControlComponent) roundControl?: RoundControlComponent;

  private unsub?: Unsubscribe;
  private indexState?: string;
  private watchedRoundId: string | null = null;
  private roundUnsubs: Unsubscribe[] = [];
  private votesUnsub?: Unsubscribe;
  private votesRetries = 0;
  private platformId = inject(PLATFORM_ID);
  private heartbeatStop?: () => void;
  private staleCheckId?: ReturnType<typeof setInterval>;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private roomService: RoomService,
    private roundService: RoundService,
    private authService: AuthService,
  ) {
    this.id = this.route.snapshot.params['id'];
  }

  async ngOnInit() {
    // Firebase Auth/Firestore nunca resolvem durante o prerender SSR (ng build gera as
    // rotas estáticas) — sem essa guarda, o build trava esperando uma Promise que nunca chega.
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      const user = (await this.authService.getCurrentUser()) ?? (await this.authService.loginAsGuest());
      this.userId = user.id;
      this.joinName = user.name ?? '';
    } catch {
      this.errorMessage = 'Não foi possível entrar como convidado.';
      return;
    }

    this.unsub = this.roomService.listenRoom(this.id, (room) => {
      this.room = room;

      if (room == undefined) {
        this.router.navigate(['/rooms/']);
        return;
      }

      this.members = Object.keys(room.members ?? {}).map((uid) => ({
        uid,
        ...room.members![uid],
      }));

      this.syncUserIndex();
      this.syncRound();
      this.syncHeartbeat();
    });

    this.staleCheckId = setInterval(() => this.checkStale(), STALE_CHECK_INTERVAL_MS);
  }

  // Só o dono grava o heartbeat, e só enquanto está de fato vendo a própria sala aberta.
  private syncHeartbeat() {
    const shouldRun = this.isOwner && this.room?.status === 'open';

    if (shouldRun && this.heartbeatStop == null) {
      this.heartbeatStop = this.roomService.startOwnerHeartbeat(this.id);
    } else if (!shouldRun && this.heartbeatStop != null) {
      this.heartbeatStop();
      this.heartbeatStop = undefined;
    }
  }

  // Qualquer aprovado tenta encerrar por dono ausente/inatividade; as rules decidem de
  // verdade comparando com o relógio do servidor, então uma tentativa de má-fé só falha.
  private checkStale() {
    if (this.room == null || this.myMember?.status !== 'approved') {
      return;
    }

    this.roomService.checkStaleAndClose(this.room).catch(() => { });
  }

  // users/{uid}/rooms é só cache de "minhas salas": só escrito pelo próprio usuário (rules),
  // então o vínculo é criado ao ser aprovado e removido ao perder a vaga.
  private async syncUserIndex() {
    const state = this.myMember?.status ?? 'none';

    if (this.userId == null || state === this.indexState || state === 'pending') {
      return;
    }

    this.indexState = state;

    try {
      if (state === 'approved') {
        await this.roomService.addToUserIndex(this.userId, this.id, this.room?.title ?? '');
      } else {
        await this.roomService.removeFromUserIndex(this.userId, this.id);
      }
    } catch {
      this.indexState = undefined;
    }
  }

  // Só membros aprovados leem a rodada (rules). Os votos dos outros só são assinados
  // depois de revelada — antes disso as rules negam, e o valor nem chega ao navegador.
  private syncRound() {
    const roundId = this.myMember?.status === 'approved' ? this.room?.currentRoundId ?? null : null;

    if (roundId === this.watchedRoundId || this.userId == null) {
      return;
    }

    this.stopRoundListeners();
    this.watchedRoundId = roundId;

    if (roundId == null) {
      return;
    }

    this.roundUnsubs.push(
      this.roundService.listenRound(this.id, roundId, (round, hasPendingWrites) => {
        this.round = round;

        if (!hasPendingWrites) {
          this.syncVotes(roundId);
        }
      }),
      this.roundService.listenMyVote(this.id, roundId, this.userId, (vote) => this.myVote = vote),
    );
  }

  private syncVotes(roundId: string) {
    if (!this.round?.revealed || this.votesUnsub) {
      return;
    }

    this.votesUnsub = this.roundService.listenVotes(this.id, roundId, (votes) => this.votes = votes, () => {
      this.votesUnsub = undefined;

      if (this.watchedRoundId === roundId && this.votesRetries++ < 3) {
        setTimeout(() => this.syncVotes(roundId), 1500);
      }
    });
  }

  private stopRoundListeners() {
    this.roundUnsubs.forEach((unsub) => unsub());
    this.roundUnsubs = [];
    this.votesUnsub?.();
    this.votesUnsub = undefined;
    this.votesRetries = 0;
    this.round = undefined;
    this.myVote = undefined;
    this.votes = undefined;
  }

  ngOnDestroy() {
    this.unsub?.();
    this.stopRoundListeners();
    this.watchedRoundId = null;
    this.heartbeatStop?.();
    clearInterval(this.staleCheckId);
  }

  get isOwner(): boolean {
    return this.userId != null && this.userId === this.room?.ownerId;
  }

  get isFacilitator(): boolean {
    return this.room?.status === 'open' && this.userId != null
      && (this.userId === this.room.ownerId || this.userId === this.room.controllerId);
  }

  get canVote(): boolean {
    return this.room?.status === 'open' && this.round != null && !this.round.revealed;
  }

  get myMember(): MemberRow | undefined {
    return this.members.find((member) => member.uid === this.userId);
  }

  get approvedMembers(): MemberRow[] {
    return this.members.filter((member) => member.status === 'approved');
  }

  get pendingMembers(): MemberRow[] {
    return this.members.filter((member) => member.status === 'pending');
  }

  get useTableSeats(): boolean {
    return this.approvedMembers.length > 0 && this.approvedMembers.length <= MAX_TABLE_SEATS;
  }

  // eu sempre na borda de baixo, centralizado; o resto se espalha em rodízio topo/baixo/
  // esquerda/direita (cada pessoa nova entra na próxima borda do ciclo, não acumula tudo
  // no topo/baixo antes de usar as laterais)
  get seatEdges(): SeatEdges {
    const edges: SeatEdges = { top: [], left: [], right: [], bottom: [] };
    const others = this.approvedMembers.filter((member) => member.uid !== this.userId);
    others.forEach((member, i) => edges[EDGE_CYCLE[i % EDGE_CYCLE.length]].push(member));

    const me = this.approvedMembers.find((member) => member.uid === this.userId);
    if (me) {
      edges.bottom.splice(Math.floor(edges.bottom.length / 2), 0, me);
    }
    return edges;
  }

  get votesLoaded(): boolean {
    return this.votes != undefined;
  }

  hasVoted(uid: string): boolean {
    return this.round?.voters?.[uid] === true;
  }

  voteLabel(uid: string): string {
    return this.votes?.[uid]?.value ?? '—';
  }

  private get options(): PointingOption[] {
    return this.round?.pointingType.options ?? [];
  }

  get average(): number | null {
    if (this.votes == undefined) {
      return null;
    }

    return averageWeight(Object.values(this.votes).map((vote) => weightOf(vote.value, this.options)));
  }

  get averageText(): string {
    return this.average == null ? '—' : String(Math.round(this.average * 100) / 100);
  }

  get approximateLabel(): string {
    return this.average == null ? '—' : nearestOption(this.average, this.options)?.label ?? '—';
  }

  private async attempt(action: () => Promise<unknown>, message: string): Promise<boolean> {
    this.errorMessage = '';

    try {
      await action();
      return true;
    } catch {
      this.errorMessage = message;
      return false;
    }
  }

  async requestJoin() {
    const name = this.joinName.trim();

    if (this.userId == null || name === '') {
      return;
    }

    await this.attempt(() => this.roomService.requestJoin(this.id, this.userId!, name), 'Não foi possível pedir entrada na sala.');
  }

  async copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      this.linkCopied = true;
      setTimeout(() => this.linkCopied = false, 2000);
    } catch {
      this.errorMessage = 'Não foi possível copiar. Copie o endereço do navegador.';
    }
  }

  async approveMember(uid: string) {
    await this.attempt(() => this.roomService.approveMember(this.id, uid), 'Não foi possível aprovar o participante.');
  }

  async removeMember(uid: string) {
    await this.attempt(() => this.roomService.removeMember(this.id, uid), 'Não foi possível remover o participante.');
  }

  async changeController(controllerId: string) {
    await this.attempt(() => this.roomService.updateControllerId(this.id, controllerId), 'Não foi possível trocar o controlador.');
  }

  async closeRoom() {
    await this.attempt(() => this.roomService.closeRoom(this.id), 'Não foi possível encerrar a sala.');
  }

  async startRound(event: { text: string; pointingType: PointingType }) {
    if (this.userId == null || this.startingRound) {
      return;
    }

    this.startingRound = true;

    const started = await this.attempt(() => this.roundService.startRound(this.id, this.userId!, event.text, event.pointingType), 'Não foi possível iniciar a rodada.');

    if (started) {
      this.roundControl?.reset();
    }

    this.startingRound = false;
  }

  async vote(label: string) {
    if (!this.canVote || this.round?.id == null || this.userId == null) {
      return;
    }

    await this.attempt(() => this.roundService.castVote(this.id, this.round!.id!, this.userId!, label, this.hasVoted(this.userId!)), 'Não foi possível registrar o voto.');
  }

  async revealRound() {
    if (this.round?.id == null || this.userId == null) {
      return;
    }

    await this.attempt(() => this.roundService.revealRound(this.id, this.round!.id!, this.userId!), 'Não foi possível revelar os votos.');
  }
}
