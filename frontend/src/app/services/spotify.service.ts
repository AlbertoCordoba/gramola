import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SpotifyConnectService {
  private http = inject(HttpClient);
  // El backend siempre está en localhost:8080
  private apiUrl = 'http://localhost:8080/api/spotify'; 

  // 1. Obtener URL de Login
  getAuthUrl(userId: string | number): Observable<any> {
    const params = new HttpParams().set('barId', userId.toString());
    return this.http.get(`${this.apiUrl}/auth-url`, { params });
  }

  // 2. Enviar código al Backend (Puente para el Callback)
  enviarCodigoAlBackend(code: string, userId: string | number): Observable<any> {
    const params = new HttpParams()
      .set('code', code)
      .set('state', userId.toString());
    return this.http.get(`${this.apiUrl}/callback`, { params });
  }

  // 3. Obtener Token (para el reproductor SDK)
  getToken(userId: string | number): Observable<any> {
    const params = new HttpParams().set('barId', userId.toString());
    return this.http.get(`${this.apiUrl}/token`, { params });
  }

  // 4. Buscador de Playlists/Canciones
  search(query: string, userId: string | number, type: string = 'track'): Observable<any> {
    const params = new HttpParams()
      .set('q', query)
      .set('type', type)
      .set('barId', userId.toString());
    return this.http.get(`${this.apiUrl}/search`, { params });
  }

  // 5. Obtener detalles de una Playlist (Lo que te fallaba)
  getPlaylist(playlistId: string, userId: string | number): Observable<any> {
    const params = new HttpParams()
        .set('id', playlistId)
        .set('barId', userId.toString());
    return this.http.get(`${this.apiUrl}/playlist`, { params });
  }

  // 6. Reproducir una Playlist o Contexto (Lo que te fallaba)
  playContext(uri: string, deviceId: string, userId: string | number, offsetUri?: string): Observable<any> {
    const body: any = {
      contextUri: uri,
      deviceId: deviceId,
      barId: userId
    };
    if (offsetUri) body.offsetUri = offsetUri;
    return this.http.post(`${this.apiUrl}/play`, body);
  }

  // 7. Reproducir una canción específica (Lo que te fallaba)
  playTrack(spotifyId: string, deviceId: string, userId: string | number): Observable<any> {
    // Si el ID no tiene el prefijo de Spotify, se lo podemos añadir aquí o en el backend
    const cleanId = spotifyId.replace('spotify:track:', '');
    return this.http.post(`${this.apiUrl}/play`, {
      spotifyId: cleanId,
      deviceId: deviceId,
      barId: userId
    });
  }
}