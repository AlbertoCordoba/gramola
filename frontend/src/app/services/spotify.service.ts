import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SpotifyConnectService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/spotify'; 

  /**
   * Genera un state aleatorio (OAuth) y lo guarda en sessionStorage.
   * Se usa para validar en el /callback que Spotify devuelve el mismo state.
   */
  generarYGuardarState(): string {
    const state = this.randomState(16);
    sessionStorage.setItem('spotify_oauth_state', state);
    return state;
  }

  /** Devuelve el state guardado previamente (o null si no existe). */
  getStateGuardado(): string | null {
    return sessionStorage.getItem('spotify_oauth_state');
  }

  /** Limpia el state guardado (se recomienda tras un callback válido). */
  limpiarStateGuardado(): void {
    sessionStorage.removeItem('spotify_oauth_state');
  }

  private randomState(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    // Preferimos crypto si está disponible
    const cryptoObj: Crypto | undefined = (globalThis as any).crypto;
    if (cryptoObj && cryptoObj.getRandomValues) {
      const bytes = new Uint8Array(length);
      cryptoObj.getRandomValues(bytes);
      for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
      return out;
    }
    for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  getAuthUrl(userId: string | number): Observable<any> {
    // El backend construye una URL de Spotify que incluye state="{barId}_{random}".
    // Nosotros también generamos un state random y lo guardamos para validar el callback.
    // Para no tocar demasiado el backend, le mandamos el barId como siempre.
    // La parte "random" la validamos en /callback.
    const params = new HttpParams().set('barId', userId.toString());
    return this.http.get(`${this.apiUrl}/auth-url`, { params });
  }

  /**
   * Envía el code al backend para que haga el intercambio por tokens.
   * IMPORTANTE: aquí NO enviamos el state random, enviamos el barId.
   */
  enviarCodigoAlBackend(code: string, barId: string | number): Observable<any> {
    const params = new HttpParams().set('code', code).set('barId', barId.toString());
    return this.http.get(`${this.apiUrl}/callback`, { params });
  }

  getToken(userId: string | number): Observable<any> {
    const params = new HttpParams().set('barId', userId.toString());
    return this.http.get(`${this.apiUrl}/token`, { params });
  }

  // NUEVO: CARGA DE DISPOSITIVOS (Figura 27)
  getDevices(barId: number | string): Observable<any> {
    const params = new HttpParams().set('barId', barId.toString());
    return this.http.get(`${this.apiUrl}/devices`, { params });
  }

  search(query: string, userId: string | number, type: string = 'track'): Observable<any> {
    const params = new HttpParams().set('q', query).set('type', type).set('barId', userId.toString());
    return this.http.get(`${this.apiUrl}/search`, { params });
  }

  getPlaylist(playlistId: string, userId: string | number): Observable<any> {
    const params = new HttpParams().set('id', playlistId).set('barId', userId.toString());
    return this.http.get(`${this.apiUrl}/playlist`, { params });
  }

  playContext(uri: string, deviceId: string, userId: string | number, offsetUri?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/play`, { contextUri: uri, deviceId: deviceId, barId: userId, offsetUri: offsetUri });
  }

  playTrack(spotifyId: string, deviceId: string, userId: string | number): Observable<any> {
    const cleanId = spotifyId.includes('spotify:track:') ? spotifyId : `spotify:track:${spotifyId}`;
    return this.http.post(`${this.apiUrl}/play`, { spotifyId: cleanId, deviceId: deviceId, barId: userId });
  }
}