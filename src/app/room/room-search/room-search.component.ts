import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { RoomService } from '../room.service';

// aceita tanto o id puro quanto um link colado (.../rooms/<id>?utm=...) -- pega só o
// último segmento não vazio do caminho, sem query string/hash, que é o id nos dois casos
function extractId(input: string): string {
  const trimmed = input.trim();

  try {
    const segments = new URL(trimmed).pathname.split('/').filter(Boolean);
    return segments[segments.length - 1] ?? trimmed;
  } catch {
    // não é uma URL válida (ex: só o código colado) -- mesmo assim tira query/hash à mão
    const segments = trimmed.split(/[?#]/)[0].split('/').filter(Boolean);
    return segments[segments.length - 1] ?? trimmed;
  }
}

@Component({
  selector: 'app-room-search',
  templateUrl: './room-search.component.html',
  styleUrl: './room-search.component.scss'
})
export class RoomSearchComponent {
  id = '';
  errorMessage = '';
  searching = false;

  constructor(
    private router: Router,
    private roomService: RoomService,
  ) { }

  async findClass() {
    if (this.searching) {
      return;
    }

    this.errorMessage = '';

    const id = extractId(this.id);
    if (!id) {
      return;
    }

    this.searching = true;
    try {
      const room = await this.roomService.getRoom(id);

      if (room == null) {
        this.errorMessage = 'Sala não encontrada. Confira o link ou código.';
        return;
      }

      this.router.navigate(['/rooms', id]);
    } catch {
      this.errorMessage = 'Não foi possível buscar a sala agora.';
    } finally {
      this.searching = false;
    }
  }
}
