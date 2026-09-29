import { TestBed } from '@angular/core/testing';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { environment } from '../../environments/environment';

import { RoomService, OWNER_GONE_TOLERANCE_MS, INACTIVITY_TOLERANCE_MS } from './room.service';
import { Room } from '../model/room.model';

const fakeTimestamp = (ms: number) => ({ toMillis: () => ms });

describe('RoomService', () => {
  let service: RoomService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
        provideFirestore(() => getFirestore()),
      ],
    });
    service = TestBed.inject(RoomService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('checkStaleAndClose', () => {
    const baseRoom = (overrides: Partial<Room>): Room => ({
      id: 'r1',
      status: 'open',
      ...overrides,
    });

    it('encerra quando o dono está ausente há mais que a tolerância', async () => {
      const closeRoom = spyOn(service, 'closeRoom').and.resolveTo();
      const room = baseRoom({ ownerLastSeen: fakeTimestamp(Date.now() - OWNER_GONE_TOLERANCE_MS - 1000) });

      await service.checkStaleAndClose(room);

      expect(closeRoom).toHaveBeenCalledWith('r1');
    });

    it('encerra quando a sala está inativa há mais que a tolerância', async () => {
      const closeRoom = spyOn(service, 'closeRoom').and.resolveTo();
      const room = baseRoom({ lastActivityAt: fakeTimestamp(Date.now() - INACTIVITY_TOLERANCE_MS - 1000) });

      await service.checkStaleAndClose(room);

      expect(closeRoom).toHaveBeenCalledWith('r1');
    });

    it('não encerra dentro da tolerância', async () => {
      const closeRoom = spyOn(service, 'closeRoom').and.resolveTo();
      const room = baseRoom({
        ownerLastSeen: fakeTimestamp(Date.now() - 5000),
        lastActivityAt: fakeTimestamp(Date.now() - 5000),
      });

      await service.checkStaleAndClose(room);

      expect(closeRoom).not.toHaveBeenCalled();
    });

    it('não encerra sala já fechada nem sem id', async () => {
      const closeRoom = spyOn(service, 'closeRoom').and.resolveTo();
      const stale = fakeTimestamp(Date.now() - INACTIVITY_TOLERANCE_MS - 1000);

      await service.checkStaleAndClose(baseRoom({ status: 'closed', lastActivityAt: stale }));
      await service.checkStaleAndClose({ status: 'open', lastActivityAt: stale });

      expect(closeRoom).not.toHaveBeenCalled();
    });

    it('não encerra sem nenhum dos dois campos (sala recém-criada antes do 1º heartbeat)', async () => {
      const closeRoom = spyOn(service, 'closeRoom').and.resolveTo();

      await service.checkStaleAndClose(baseRoom({}));

      expect(closeRoom).not.toHaveBeenCalled();
    });
  });
});
