/*
 * ======================================================================================
 * RESUMEN
 * ======================================================================================
 * Servicio de integración con Spotify.
 * IMPORTANTE: Implementa un patrón "Backend-For-Frontend" (BFF) o Proxy.
 * Las llamadas a la API de Spotify (excepto la reproducción local del SDK) 
 * se delegan al servidor Java para proteger los Tokens de Acceso y Secretos.
 * ======================================================================================
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SpotifyConnectService {
  private http = inject(HttpClient);
  // Todas las peticiones van a nuestro Backend Java, no a 'api.spotify.com'
  private apiUrl = 'http://localhost:8080/api/spotify';

  // Obtiene la URL para iniciar el flujo OAuth 2.0 (Login con Spotify)
  getAuthUrl(barId: number): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(`${this.apiUrl}/auth-url`, { 
      params: { barId: barId.toString() } 
    });
  }

  // Obtiene el Access Token fresco desde el Backend para inicializar el SDK del navegador
  getToken(barId: number): Observable<{ access_token: string }> {
    return this.http.get<{ access_token: string }>(`${this.apiUrl}/token`, { 
      params: { barId: barId.toString() } 
    });
  }

  /*
   * BUSCADOR PROXY
   * El frontend envía "q=Malamanera" al backend.
   * El backend añade el Token seguro, llama a Spotify y devuelve el JSON limpio.
   */
  search(query: string, barId: number, type: string = 'track'): Observable<any> {
    return this.http.get(`${this.apiUrl}/search`, { 
      params: { q: query, barId: barId.toString(), type: type } 
    });
  }

  // Recupera los detalles de una playlist (canciones) a través del proxy
  getPlaylist(id: string, barId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/playlist`, { 
      params: { id: id, barId: barId.toString() } 
    });
  }

  /*
   * CONTROL REMOTO (PLAY TRACK)
   * Envía la orden de reproducir una canción específica.
   * Parámetros:
   * - spotifyId: ID de la canción.
   * - deviceId: ID del "altavoz virtual" que crea el navegador.
   */
  playTrack(spotifyId: string, deviceId: string, barId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/play`, { barId, deviceId, spotifyId });
  }

  /*
   * CONTROL REMOTO (PLAY CONTEXT/PLAYLIST)
   * Envía la orden de reproducir un contexto (Album o Playlist) entero.
   * - offsetUri: Opcional. Sirve para decir "Empieza la playlist por ESTA canción concreta".
   */
  playContext(contextUri: string, deviceId: string, barId: number, offsetUri?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/play`, { 
      barId, 
      deviceId, 
      contextUri,
      offsetUri
    });
  }
}