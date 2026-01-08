import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SpotifyConnectService {
  private http = inject(HttpClient);
  // Importante: El backend sigue en localhost aunque navegues por 127.0.0.1
  private apiUrl = 'http://localhost:8080/api/spotify'; 

  getAuthUrl(userId: string | number): Observable<any> {
    const params = new HttpParams().set('barId', userId.toString());
    return this.http.get(`${this.apiUrl}/auth-url`, { params });
  }

  enviarCodigoAlBackend(code: string, userId: string | number): Observable<any> {
    const params = new HttpParams().set('code', code).set('state', userId.toString());
    return this.http.get(`${this.apiUrl}/callback`, { params });
  }

  getToken(userId: string | number): Observable<any> {
    const params = new HttpParams().set('barId', userId.toString());
    return this.http.get(`${this.apiUrl}/token`, { params });
  }

  search(query: string, userId: string | number, type: string = 'track'): Observable<any> {
    const params = new HttpParams().set('q', query).set('type', type).set('barId', userId.toString());
    return this.http.get(`${this.apiUrl}/search`, { params });
  }

  // --- MÉTODOS RECUPERADOS PARA QUE GRAMOLA NO DE ERROR ---
  getPlaylist(playlistId: string, userId: string | number): Observable<any> {
    const params = new HttpParams().set('id', playlistId).set('barId', userId.toString());
    return this.http.get(`${this.apiUrl}/playlist`, { params });
  }

  playContext(uri: string, deviceId: string, userId: string | number, offsetUri?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/play`, {
      contextUri: uri,
      deviceId: deviceId,
      barId: userId,
      offsetUri: offsetUri
    });
  }

  playTrack(spotifyId: string, deviceId: string, userId: string | number): Observable<any> {
    return this.http.post(`${this.apiUrl}/play`, {
      spotifyId: spotifyId.replace('spotify:track:', ''),
      deviceId: deviceId,
      barId: userId
    });
  }
}