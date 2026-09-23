import { Injectable, inject } from '@angular/core';
import { Firestore, FieldPath, collection, doc, onSnapshot, updateDoc, writeBatch, serverTimestamp, Unsubscribe } from '@angular/fire/firestore';
import { PointingType } from '../model/pointing-type.model';
import { Round, Vote } from '../model/round.model';

const noop = () => { };

@Injectable({
  providedIn: 'root'
})
export class RoundService {
  private firestore: Firestore = inject(Firestore);

  private roundRef(roomId: string, roundId: string) {
    return doc(this.firestore, 'rooms', roomId, 'rounds', roundId);
  }

  async startRound(roomId: string, uid: string, text: string, pointingType: PointingType): Promise<string> {
    const roundRef = doc(collection(this.firestore, 'rooms', roomId, 'rounds'));
    const batch = writeBatch(this.firestore);

    const round: Round = {
      text,
      pointingType,
      startedAt: serverTimestamp(),
      startedBy: uid,
      revealed: false,
      revealedAt: null,
      revealedBy: null,
      voters: {},
    };

    batch.set(roundRef, round);
    batch.update(doc(this.firestore, 'rooms', roomId), { currentRoundId: roundRef.id, lastActivityAt: serverTimestamp() });

    await batch.commit();

    return roundRef.id;
  }

  async castVote(roomId: string, roundId: string, uid: string, value: string, alreadyVoted: boolean): Promise<void> {
    const batch = writeBatch(this.firestore);

    batch.set(doc(this.firestore, 'rooms', roomId, 'rounds', roundId, 'votes', uid), { value, votedAt: serverTimestamp() });

    if (!alreadyVoted) {
      batch.update(this.roundRef(roomId, roundId), new FieldPath('voters', uid), true);
    }

    await batch.commit();
  }

  async revealRound(roomId: string, roundId: string, uid: string): Promise<void> {
    await updateDoc(this.roundRef(roomId, roundId), { revealed: true, revealedAt: serverTimestamp(), revealedBy: uid });
  }

  // hasPendingWrites = a mudança ainda é local, o servidor não confirmou. As rules avaliam o estado
  // do servidor, então quem depende do estado da rodada pra ler os votos deve esperar a confirmação.
  listenRound(roomId: string, roundId: string, onChange: (round: Round | undefined, hasPendingWrites: boolean) => void): Unsubscribe {
    return onSnapshot(this.roundRef(roomId, roundId), { includeMetadataChanges: true }, (snapshot) => {
      onChange(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } as Round : undefined, snapshot.metadata.hasPendingWrites);
    }, noop);
  }

  listenMyVote(roomId: string, roundId: string, uid: string, onChange: (vote: Vote | undefined) => void): Unsubscribe {
    return onSnapshot(doc(this.firestore, 'rooms', roomId, 'rounds', roundId, 'votes', uid), (snapshot) => {
      onChange(snapshot.exists() ? snapshot.data() as Vote : undefined);
    }, noop);
  }

  // Só funciona depois de revelada: antes disso as rules negam a leitura dos votos alheios.
  // Ignora snapshots vindos do cache local (que só teria o próprio voto) e só entrega o que o servidor confirmou.
  listenVotes(roomId: string, roundId: string, onChange: (votes: { [uid: string]: Vote }) => void, onError: () => void): Unsubscribe {
    return onSnapshot(collection(this.firestore, 'rooms', roomId, 'rounds', roundId, 'votes'), { includeMetadataChanges: true }, (snapshot) => {
      if (snapshot.metadata.fromCache) {
        return;
      }

      const votes: { [uid: string]: Vote } = {};
      snapshot.forEach((voteDoc) => { votes[voteDoc.id] = voteDoc.data() as Vote; });
      onChange(votes);
    }, onError);
  }
}
