import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GramolaService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/gramola';

  // barId es NUMBER (tipo numérico de TypeScript)
  anadirCancion(cancion: any, barId: number): Observable<any> { 
    const previewUrl = cancion.preview_url || cancion.previewUrl || '';
    const payload = {
      barId: barId,
      spotifyId: cancion.id,
      titulo: cancion.name,
      artista: cancion.artists[0].name,
      previewUrl: previewUrl,
      duracionMs: cancion.duration_ms || cancion.duracionMs || 0
    };
    return this.http.post(`${this.apiUrl}/cola/add`, payload);
  }

  obtenerCola(barId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/cola/${barId}`);
  }

  // Id debe ser NUMBER
  actualizarEstado(id: number, estado: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/cola/estado`, { id, estado });
  }
}