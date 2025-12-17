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

  // --- MÉTODOS PARA MULTIMEDIA (BRAVE / PESTAÑA) ---
  actualizarMetadataMultimedia(track: any) {
    if (!track) return;

    const nombre = track.name;
    const artista = track.artists[0]?.name || 'Desconocido';
    const imagen = track.album?.images[0]?.url || 'gramola.png';

    // Actualiza el nombre en la pestaña del navegador
    this.titleService.setTitle(`▶️ ${nombre} - ${artista}`);

    // Actualiza la información en el sistema (Brave, Windows, Mac)
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: nombre,
        artist: artista,
        album: 'Gramola Virtual',
        artwork: [{ src: imagen, sizes: '512x512', type: 'image/png' }]
      });
    }
  }

  // --- MÉTODOS DE LA GRAMOLA (RESTAURADOS) ---
  obtenerCola(barId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/cola/${barId}`);
  }

  actualizarEstado(id: number, estado: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/estado/${id}`, { estado });
  }

  getPrecios(barId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/precios/${barId}`);
  }

  solicitarCancion(solicitud: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/solicitar`, solicitud);
  }
}