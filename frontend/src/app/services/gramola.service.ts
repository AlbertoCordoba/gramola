/*
 * ======================================================================================
 * RESUMEN
 * ======================================================================================
 * Gestiona la lógica de negocio de la Gramola: cola de reproducción, historial y precios.
 * También interactúa con la API del navegador (Media Session API) para mostrar
 * la canción actual en las notificaciones del sistema operativo.
 * ======================================================================================
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Title } from '@angular/platform-browser'; // Servicio para cambiar el <title> del HTML

@Injectable({
  providedIn: 'root'
})
export class GramolaService {
  private http = inject(HttpClient);
  private titleService = inject(Title);
  
  private apiUrl = 'http://localhost:8080/api/gramola';
  private apiBaresUrl = 'http://localhost:8080/api/bares';

  /*
   * INTEGRACIÓN NATIVA (Media Session API)
   * Este método no habla con el Backend, sino con el Navegador (Chrome/Firefox/Edge).
   * Permite que cuando el usuario minimice la ventana, vea qué canción suena
   * y la carátula en el control de volumen del sistema.
   */
  actualizarMetadataMultimedia(track: any) {
    if (!track) return;

    const nombre = track.name;
    // Protección contra arrays vacíos (el operador ?. evita que la app explote si no hay artistas)
    const artista = track.artists[0]?.name || 'Desconocido';
    const imagen = track.album?.images[0]?.url || 'gramola.png';

    // 1. Cambia el título de la pestaña del navegador dinámicamente
    this.titleService.setTitle(`▶️ ${nombre} - ${artista}`);

    // 2. Configura la notificación multimedia del sistema operativo
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: nombre,
        artist: artista,
        album: 'Gramola Virtual',
        artwork: [{ src: imagen, sizes: '512x512', type: 'image/png' }]
      });
    }
  }

  // --- MÉTODOS DE LA API REST ---

  // Recupera la lista de canciones en cola (GET)
  obtenerCola(barId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/cola/${barId}`);
  }

  /*
   * SINCRONIZACIÓN DE ESTADO
   * El reproductor de Spotify (Frontend) avisa al Backend cuando una canción
   * empieza ('SONANDO') o acaba ('TERMINADA') para mantener la base de datos al día.
   */
  actualizarEstado(id: number, estado: string): Observable<any> {
    // Enviamos un objeto JSON { id: 1, estado: "TERMINADA" }
    return this.http.post(`${this.apiUrl}/cola/estado`, { id, estado });
  }

  // Obtiene precios específicos de un bar (si hubiera personalización por local)
  getPrecios(barId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/precios/${barId}`);
  }

  // Solicitar canción (Legacy/Alternativo)
  solicitarCancion(solicitud: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/solicitar`, solicitud);
  }

  // Recupera la configuración global de precios (Tabla 'ConfiguracionPrecios')
  obtenerConfiguracionPrecios(): Observable<any> {
    return this.http.get(`${this.apiBaresUrl}/precios`);
  }
}