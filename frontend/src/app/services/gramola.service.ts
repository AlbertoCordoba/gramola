import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GramolaService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/gramola';

  // Añadir canción (y pagar)
  anadirCancion(cancion: any, barId: number): Observable<any> {
    const payload = {
      barId: barId,
      spotifyId: cancion.id,
      titulo: cancion.name,
      artista: cancion.artists[0].name
    };
    return this.http.post(`${this.apiUrl}/cola/add`, payload);
  }

  // Obtener la cola actual
  obtenerCola(barId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/cola/${barId}`);
  }
}