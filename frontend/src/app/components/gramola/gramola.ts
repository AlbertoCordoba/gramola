import { Component, inject, OnDestroy, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { SpotifyConnectService } from '../../services/spotify.service';
import { GramolaService } from '../../services/gramola.service';
import { PagoStateService } from '../../services/pago-state.service';
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
  imports: [CommonModule, FormsModule, PasarelaPagoComponent],
  templateUrl: './gramola.html',
  styleUrl: './gramola.css'
})
export class Gramola implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private spotifyService = inject(SpotifyConnectService);
  private gramolaService = inject(GramolaService);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private pagoState = inject(PagoStateService);

  usuario: any = null;
  playlistFondo: any = null;

  busqueda: string = '';
  isSearching: boolean = false;
  searchResults: any[] = [];
  
  colaReproduccion: any[] = [];
  player: any;
  deviceId: string = '';
  currentTrack: any = null;
  cancionSonando: any = null; 
  isPaused: boolean = false;
  showPaymentModal: boolean = false;

  private pollingInterval: any;
  private cambiandoCancion: boolean = false;
  private wasPlaying: boolean = false;
  private lastTrackId: string = ''; // Para detectar cambio de canción

  constructor() {
    const userJson = localStorage.getItem('usuarioBar');
    if (userJson) {
      this.usuario = JSON.parse(userJson);
    } else {
      this.router.navigate(['/login']);
    }
  }

  ngOnInit() {
    const plGuardada = localStorage.getItem('playlistFondo');
    if (plGuardada) {
        this.playlistFondo = JSON.parse(plGuardada);
    } else {
        this.router.navigate(['/config-audio']);
        return;
    }

    this.route.queryParams.subscribe((params: any) => {
      if (params['status'] === 'success') {
        this.router.navigate([], { queryParams: {}, replaceUrl: true });
      }
    });

    if (this.usuario) {
      this.initSpotifySDK();
      this.cargarCola();
      this.pollingInterval = setInterval(() => {
        if (!this.cambiandoCancion) this.refrescarColaSilenciosamente();
      }, 3000);
    }
  }

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
        }
      }
    });
  }

  initializePlayer(token: string) {
    this.player = new window.Spotify.Player({
      name: 'Gramola Virtual Player',
      getOAuthToken: (cb: any) => cb(token),
      volume: 0.5
    });

    this.player.addListener('ready', ({ device_id }: any) => {
      this.ngZone.run(() => {
        console.log('Player Listo:', device_id);
        this.deviceId = device_id;
        
        // Al arrancar, si hay cola ponemos cola. Si no, ambiente.
        if (this.colaReproduccion.length > 0) {
            this.reproducir(this.colaReproduccion[0]);
        } else {
            this.reproducirFondo();
        }
      });
    });

    this.player.addListener('player_state_changed', (state: any) => {
      this.ngZone.run(() => {
        if (!state) return;
        
        const nuevoTrackId = state.track_window.current_track.id;
        
        // 1. DETECTAR CAMBIO DE CANCIÓN (Cuando termina la de ambiente y empieza la siguiente)
        if (this.lastTrackId && this.lastTrackId !== nuevoTrackId) {
            // Si estamos en modo ambiente (sin canción pagada sonando) y hay cola pendiente...
            if (!this.cancionSonando && this.colaReproduccion.length > 0 && !this.cambiandoCancion) {
                console.log("Canción de ambiente terminada. ¡Entra pedido!");
                this.siguienteCancion(); // Esto pondrá la primera de la cola
            }
        }
        this.lastTrackId = nuevoTrackId;

        this.currentTrack = state.track_window.current_track;
        this.isPaused = state.paused;
        if (!state.paused) this.wasPlaying = true;

        // 2. DETECTAR FIN DE CANCIÓN (Solo para las que se pausan al final, usualmente las pagadas sueltas)
        if (state.paused && state.position === 0 && this.wasPlaying && !this.cambiandoCancion) {
            this.wasPlaying = false; 
            if (this.cancionSonando) {
                console.log("Canción pagada terminada.");
                this.siguienteCancion();
            }
        }
        this.cdr.detectChanges();
      });
    });
    this.player.connect();
  }

  reproducirFondo() {
    if (!this.playlistFondo || !this.deviceId) return;
    console.log("Iniciando ambiente:", this.playlistFondo.name);
    this.spotifyService.playContext(this.playlistFondo.uri, this.deviceId, this.usuario.id).subscribe();
  }

  search() {
    if (!this.busqueda || this.busqueda.trim().length <= 2) return;
    this.isSearching = true; 
    this.searchResults = []; 
    this.spotifyService.search(this.busqueda, this.usuario.id, 'track').subscribe({
      next: (res: any) => {
        this.ngZone.run(() => {
          this.searchResults = res.tracks.items;
          this.isSearching = false;
          this.cdr.detectChanges();
        });
      },
      error: () => this.isSearching = false
    });
  }

  anadir(track: any) {
    const previewUrl = track.preview_url || track.previewUrl || '';
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
    this.showPaymentModal = true;
  }

  onPaymentClosed(success: boolean) {
    this.showPaymentModal = false;
    if (success) {
      this.busqueda = '';
      this.searchResults = [];
      this.cargarCola(); // Solo actualizamos la lista, NO reproducimos
    }
  }

  // --- LÓGICA DE COLA CORREGIDA ---
  cargarCola() {
    this.gramolaService.obtenerCola(Number(this.usuario.id)).subscribe({
      next: (res: any) => {
        this.ngZone.run(() => {
            this.colaReproduccion = res;
            // CORRECCIÓN: YA NO REPRODUCIMOS AQUÍ AUTOMÁTICAMENTE.
            // Dejamos que suene lo que estaba sonando (ambiente).
            // El listener 'player_state_changed' se encargará de cambiar cuando acabe la actual.
        });
      }
    });
  }

  refrescarColaSilenciosamente() {
    this.gramolaService.obtenerCola(Number(this.usuario.id)).subscribe({
      next: (res: any) => {
        this.ngZone.run(() => {
          this.colaReproduccion = res;
          // Igual aquí: solo actualizamos datos visuales.
        });
      }
    });
  }

  reproducir(cancion: any) {
    if (!this.deviceId) return;
    this.spotifyService.playTrack(cancion.spotifyId, this.deviceId, this.usuario.id).subscribe({
      next: () => {
        console.log("Reproduciendo pagada:", cancion.titulo);
        this.cancionSonando = cancion;
        this.gramolaService.actualizarEstado(Number(cancion.id), 'SONANDO').subscribe();
        this.cambiandoCancion = false;
        this.wasPlaying = false; 
      },
      error: () => this.cambiandoCancion = false
    });
  }

  siguienteCancion() {
    // Si cola vacía -> Ambiente
    if (this.colaReproduccion.length === 0) {
        console.log("Cola vacía. Volviendo a ambiente...");
        this.cancionSonando = null; 
        this.reproducirFondo();
        this.cambiandoCancion = false;
        return;
    }
    
    if (this.cambiandoCancion) return;
    this.cambiandoCancion = true;

    if (this.cancionSonando) {
        this.gramolaService.actualizarEstado(Number(this.cancionSonando.id), 'TERMINADA').subscribe();
    }

    const siguiente = this.colaReproduccion[0];
    this.colaReproduccion.shift(); // Quitar de la lista visual localmente
    this.reproducir(siguiente);
  }

  logout() {
    localStorage.removeItem('usuarioBar');
    localStorage.removeItem('playlistFondo');
    this.player?.disconnect();
    this.router.navigate(['/login']);
  }

  ngOnDestroy() {
    this.player?.disconnect();
    if (this.pollingInterval) clearInterval(this.pollingInterval);
  }
}