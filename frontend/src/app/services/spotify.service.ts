import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SpotifyConnectService {
  private http = inject(HttpClient);
  // Asegúrate de que este puerto coincida con tu backend (8080)
  private apiUrl = 'http://localhost:8080/api/spotify';

  // 1. Obtener URL de Auth (Pasamos barId para el 'state')
  getAuthUrl(barId: number): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(`${this.apiUrl}/auth-url`, { 
      params: { barId: barId.toString() } 
    });
  }

  // 2. Buscar canciones (Pasamos barId para que el backend use el token correcto)
  searchTracks(query: string, barId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/search`, { 
      params: { 
        q: query,
        barId: barId.toString() 
      } 
    });
  }

  // 3. Obtener Token para el SDK (Frontend) - ESTE FALTABA
  getToken(barId: number): Observable<{ access_token: string }> {
    return this.http.get<{ access_token: string }>(`${this.apiUrl}/token`, {
      params: { barId: barId.toString() }
    });
  }

  // 4. Reproducir canción (Proxy al backend) - ESTE FALTABA
  playTrack(spotifyId: string, deviceId: string, barId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/play`, {
      barId,
      deviceId,
      spotifyId
    });
  }
}