import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SpotifyConnectService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/spotify';

  // Llama al backend para obtener la URL de login de Spotify
  getAuthUrl(): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(`${this.apiUrl}/auth-url`);
  }

  // Llama al backend para buscar canciones (requiere que el token ya esté guardado en el backend)
  searchTracks(query: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/search`, { params: { q: query } });
  }
}