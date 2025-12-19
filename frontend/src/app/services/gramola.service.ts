import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Title } from '@angular/platform-browser';

@Injectable({
  providedIn: 'root'
})
export class GramolaService {
  private http = inject(HttpClient);
  private titleService = inject(Title);
  
  private apiUrl = 'http://localhost:8080/api/gramola';

  // --- MÉTODOS PARA MULTIMEDIA ---
  actualizarMetadataMultimedia(track: any) {
    if (!track) return;

    const nombre = track.name;
    const artista = track.artists[0]?.name || 'Desconocido';
    const imagen = track.album?.images[0]?.url || 'gramola.png';

    this.titleService.setTitle(`▶️ ${nombre} - ${artista}`);

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: nombre,
        artist: artista,
        album: 'Gramola Virtual',
        artwork: [{ src: imagen, sizes: '512x512', type: 'image/png' }]
      });
    }
  }

  // --- MÉTODOS DE LA COLA ---
  obtenerCola(barId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/cola/${barId}`);
  }

  /**
   * CORRECCIÓN: Se cambia a POST y ruta /cola/estado para coincidir con el backend.
   * Envía un objeto con 'id' y 'estado'.
   */
  actualizarEstado(id: number, estado: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/cola/estado`, { id, estado });
  }

  getPrecios(barId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/precios/${barId}`);
  }

  solicitarCancion(solicitud: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/solicitar`, solicitud);
  }
}