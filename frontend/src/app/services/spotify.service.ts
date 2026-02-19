import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SpotifyConnectService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/spotify'; 

  // MÉTODO: Solicita al backend la URL oficial de Spotify para iniciar el login (OAuth2).
  getAuthUrl(userId: string | number): Observable<any> {
    const params = new HttpParams().set('barId', userId.toString());
    return this.http.get(`${this.apiUrl}/auth-url`, { params });
  }
  // MÉTODO: Envía el código temporal recibido tras el login para que el backend obtenga los tokens.
  enviarCodigoAlBackend(code: string, userId: string | number): Observable<any> {
    const params = new HttpParams().set('code', code).set('state', userId.toString());
    return this.http.get(`${this.apiUrl}/callback`, { params });
  }
  // MÉTODO: Recupera el token de acceso actual del bar almacenado en la base de datos.
  getToken(userId: string | number): Observable<any> {
    const params = new HttpParams().set('barId', userId.toString());
    return this.http.get(`${this.apiUrl}/token`, { params });
  }

  // MÉTODO: Obtiene la lista de reproductores activos (móvil, PC, Web) para que el bar elija la salida de audio.
  getDevices(barId: number | string): Observable<any> {
    const params = new HttpParams().set('barId', barId.toString());
    return this.http.get(`${this.apiUrl}/devices`, { params });
  }
  // MÉTODO: Busca canciones o playlists directamente en la API de Spotify a través de nuestro servidor.
  search(query: string, userId: string | number, type: string = 'track'): Observable<any> {
    const params = new HttpParams().set('q', query).set('type', type).set('barId', userId.toString());
    return this.http.get(`${this.apiUrl}/search`, { params });
  }
  // MÉTODO: Recupera todos los detalles y canciones de una playlist específica.
  getPlaylist(playlistId: string, userId: string | number): Observable<any> {
    const params = new HttpParams().set('id', playlistId).set('barId', userId.toString());
    return this.http.get(`${this.apiUrl}/playlist`, { params });
  }
  // MÉTODO: Lógica de reproducción para álbumes o playlists (Música de ambiente).
  playContext(uri: string, deviceId: string, userId: string | number, offsetUri?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/play`, { contextUri: uri, deviceId: deviceId, barId: userId, offsetUri: offsetUri });
  }
  // MÉTODO: Lógica de reproducción para una canción concreta (Pedido del cliente).
  // Limpia el ID para asegurar que tenga el prefijo 'spotify:track:' que exige la API.
  playTrack(spotifyId: string, deviceId: string, userId: string | number): Observable<any> {
    const cleanId = spotifyId.includes('spotify:track:') ? spotifyId : `spotify:track:${spotifyId}`;
    return this.http.post(`${this.apiUrl}/play`, { spotifyId: cleanId, deviceId: deviceId, barId: userId });
  }
}