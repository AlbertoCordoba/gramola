import { Component, inject, OnDestroy, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { SpotifyConnectService } from '../../services/spotify.service';
import { GramolaService } from '../../services/gramola.service';
import { PagoStateService } from '../../services/pago-state.service';
// IMPORTAMOS EL COMPONENTE DE PAGO
import { PasarelaPagoComponent } from '../pasarela-pago/pasarela-pago.component';

declare global {
  interface Window { 
    onSpotifyWebPlaybackSDKReady: () => void; 
    Spotify: any; 
  }
}

@Component({
  selector: 'app-gramola',
  standalone: true,
  imports: [CommonModule, FormsModule, PasarelaPagoComponent], // <--- AÑADIR AQUÍ
  templateUrl: './gramola.html',
  styleUrl: './gramola.css'
})
export class Gramola implements OnInit, OnDestroy {
  // ... Inyecciones iguales ...
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private spotifyService = inject(SpotifyConnectService);
  private gramolaService = inject(GramolaService);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private pagoState = inject(PagoStateService);

  // ... Variables iguales ...
  usuario: any = null;
  spotifyConnected: boolean = false;
  busqueda: string = '';
  isSearching: boolean = false;
  searchResults: any[] = [];
  colaReproduccion: any[] = [];
  player: any;
  deviceId: string = '';
  currentTrack: any = null;
  cancionSonando: any = null;
  isPaused: boolean = false;
  
  // NUEVA VARIABLE PARA EL MODAL
  showPaymentModal: boolean = false;

  private pollingInterval: any;
  private cambiandoCancion: boolean = false;
  private wasPlaying: boolean = false; 

  constructor() {
    const userJson = localStorage.getItem('usuarioBar');
    if (userJson) {
      this.usuario = JSON.parse(userJson);
    } else {
      this.router.navigate(['/login']);
    }
  }

  ngOnInit() {
    // ... Código igual que antes ...
    this.route.queryParams.subscribe((params: any) => {
      if (params['status'] === 'success') {
        this.spotifyConnected = true;
        this.router.navigate([], { queryParams: {}, replaceUrl: true });
      }
    });

    if (this.usuario) {
      this.initSpotifySDK();
      this.cargarCola();

      this.pollingInterval = setInterval(() => {
        if (!this.cambiandoCancion) {
          this.refrescarColaSilenciosamente();
        }
      }, 3000);
    }
  }

  // ... initSpotifySDK, requestTokenAndConnect, initializePlayer, connectSpotify IGUALES ...
  // ... Copia el código que ya tenías para estas funciones ...
  
  initSpotifySDK() {
    if (window.Spotify) {
      this.requestTokenAndConnect();
      return;
    }
    window.onSpotifyWebPlaybackSDKReady = () => { this.requestTokenAndConnect(); };
    if (!document.getElementById('spotify-player-script')) {
      const script = document.createElement('script');
      script.id = 'spotify-player-script';
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }

  requestTokenAndConnect() {
    this.spotifyService.getToken(this.usuario.id).subscribe({
      next: (res: any) => {
        if (res.access_token) {
          this.initializePlayer(res.access_token);
          this.spotifyConnected = true;
        }
      },
      error: (err: any) => console.warn('Error obteniendo token:', err)
    });
  }

  initializePlayer(token: string) {
    this.player = new window.Spotify.Player({
      name: 'Gramola Virtual Player',
      getOAuthToken: (cb: (token: string) => void) => { cb(token); },
      volume: 0.5
    });
    this.player.addListener('ready', ({ device_id }: any) => {
      this.ngZone.run(() => {
        console.log('Player Listo ID:', device_id);
        this.deviceId = device_id;
        if (this.colaReproduccion.length > 0 && !this.currentTrack) {
          this.reproducir(this.colaReproduccion[0]);
        }
      });
    });
    this.player.addListener('player_state_changed', (state: any) => {
      this.ngZone.run(() => {
        if (!state) return;
        this.currentTrack = state.track_window.current_track;
        this.isPaused = state.paused;
        if (!state.paused) this.wasPlaying = true;
        if (state.paused && state.position === 0 && this.wasPlaying) {
            if (!this.cambiandoCancion) {
                this.wasPlaying = false; 
                this.siguienteCancion();
            }
        }
        this.cdr.detectChanges();
      });
    });
    this.player.connect();
  }

  connectSpotify() {
    this.spotifyService.getAuthUrl(this.usuario.id).subscribe({
      next: (res: any) => window.location.href = res.url,
      error: (err: any) => console.error(err)
    });
  }

  search() {
    if (!this.busqueda || this.busqueda.trim().length <= 2) return;
    this.isSearching = true; 
    this.searchResults = []; 
    this.spotifyService.searchTracks(this.busqueda, this.usuario.id).subscribe({
      next: (res: any) => {
        this.ngZone.run(() => {
          this.searchResults = res.tracks.items;
          this.isSearching = false;
          this.cdr.detectChanges(); 
        });
      },
      error: (err: any) => {
        this.isSearching = false;
        this.cdr.detectChanges();
      }
    });
  }

  // --- MODIFICADO: ABRIR MODAL EN LUGAR DE NAVEGAR ---
  anadir(track: any) {
    const previewUrl = track.preview_url || track.previewUrl || '';
    
    // Configuramos los datos en el servicio (igual que antes)
    this.pagoState.setPago({
      concepto: `Canción: ${track.name}`,
      precio: 0.50,
      tipo: 'CANCION',
      payload: {
        barId: Number(this.usuario.id),
        spotifyId: track.id,
        titulo: track.name,
        artista: track.artists[0].name,
        previewUrl: previewUrl,
        duracionMs: track.duration_ms || 0
      }
    });

    // En vez de router.navigate, activamos el modal
    this.showPaymentModal = true;
  }

  // --- CALLBACK CUANDO SE CIERRA EL MODAL ---
  onPaymentClosed(success: boolean) {
    this.showPaymentModal = false; // Cerramos modal
    
    if (success) {
      // Si el pago fue exitoso, limpiamos búsqueda y recargamos cola
      this.busqueda = '';
      this.searchResults = [];
      this.cargarCola();
    }
    // Si canceló (success=false), no hacemos nada más, la música sigue sonando.
  }

  // ... cargarCola, refrescarColaSilenciosamente, reproducir, siguienteCancion, logout, ngOnDestroy IGUALES ...
  cargarCola() {
    this.gramolaService.obtenerCola(Number(this.usuario.id)).subscribe({
      next: (res: any) => {
        this.ngZone.run(() => {
          this.colaReproduccion = res;
          if (this.deviceId && this.colaReproduccion.length > 0 && !this.currentTrack && !this.cambiandoCancion) {
            this.reproducir(this.colaReproduccion[0]);
          }
        });
      }
    });
  }

  refrescarColaSilenciosamente() {
    this.gramolaService.obtenerCola(Number(this.usuario.id)).subscribe({
      next: (res: any) => this.ngZone.run(() => this.colaReproduccion = res)
    });
  }

  reproducir(cancion: any) {
    if (!this.deviceId) return;
    this.spotifyService.playTrack(cancion.spotifyId, this.deviceId, this.usuario.id).subscribe({
      next: () => {
        this.cancionSonando = cancion;
        this.gramolaService.actualizarEstado(Number(cancion.id), 'SONANDO').subscribe();
        this.cambiandoCancion = false;
        this.wasPlaying = false; 
      },
      error: () => this.cambiandoCancion = false
    });
  }

  siguienteCancion() {
    if (this.colaReproduccion.length === 0) return;
    if (this.cambiandoCancion) return;
    this.cambiandoCancion = true;
    if (this.cancionSonando) {
        this.gramolaService.actualizarEstado(Number(this.cancionSonando.id), 'TERMINADA').subscribe();
    }
    const siguiente = this.colaReproduccion[0];
    this.colaReproduccion.shift(); 
    this.reproducir(siguiente);
  }

  logout() {
    localStorage.removeItem('usuarioBar');
    if (this.player) this.player.disconnect();
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    this.router.navigate(['/login']);
  }

  ngOnDestroy() {
    if (this.player) this.player.disconnect();
    if (this.pollingInterval) clearInterval(this.pollingInterval);
  }
}