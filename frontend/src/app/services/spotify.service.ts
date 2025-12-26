import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SpotifyConnectService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/spotify';

  getAuthUrl(barId: number): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(`${this.apiUrl}/auth-url`, { 
      params: { barId: barId.toString() } 
    });
  }

  getToken(barId: number): Observable<{ access_token: string }> {
    return this.http.get<{ access_token: string }>(`${this.apiUrl}/token`, { 
      params: { barId: barId.toString() } 
    });
  }

  search(query: string, barId: number, type: string = 'track'): Observable<any> {
    return this.http.get(`${this.apiUrl}/search`, { 
      params: { q: query, barId: barId.toString(), type: type } 
    });
  }

  // --- ESTE ES EL MÉTODO QUE TE FALTABA ---
  getPlaylist(id: string, barId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/playlist`, { 
      params: { id: id, barId: barId.toString() } 
    });
  }

  playTrack(spotifyId: string, deviceId: string, barId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/play`, { barId, deviceId, spotifyId });
  }

  playContext(contextUri: string, deviceId: string, barId: number, offsetUri?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/play`, { 
      barId, 
      deviceId, 
      contextUri,
      offsetUri
    });
  }
}