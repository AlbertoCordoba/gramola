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

type ModoReproduccion = 'AMBIENTE' | 'PEDIDO';

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
  
  // INYECCIÓN DE SERVICIOS PARA LA UI
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
  
  // Estado de reproducción
  currentTrack: any = null;
  isPaused: boolean = false;
  modoReproduccion: ModoReproduccion = 'AMBIENTE';
  cancionSonando: any = null; 
  resumeTrackUri: string = ''; 
  
  showPaymentModal: boolean = false;

  private pollingInterval: any;
  private lastTrackId: string = ''; 
  private changingTrack: boolean = false; 

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
      
      // INTERVALO DE ACTUALIZACIÓN DE COLA
      this.pollingInterval = setInterval(() => {
        if (!this.changingTrack) {
          this.cargarCola();
        }
      }, 5000);
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
        console.log('Player Listo. Device ID:', device_id);
        this.deviceId = device_id;
        this.reproducirAmbiente();
      });
    });

    // LISTENER DE CAMBIO DE ESTADO (CANCION, PAUSE, PLAY)
    this.player.addListener('player_state_changed', (state: any) => {
      this.ngZone.run(() => {
        this.gestionarCambioDeEstado(state);
        // ¡IMPORTANTE! Forzar actualización visual inmediata
        this.cdr.detectChanges(); 
      });
    });

    this.player.connect();
  }

  // --- LÓGICA DE REPRODUCCIÓN ---

  gestionarCambioDeEstado(state: any) {
    if (!state) return;

    const currentTrackId = state.track_window.current_track?.id;
    const currentTrackUri = state.track_window.current_track?.uri;
    const isPaused = state.paused;
    const position = state.position;

    this.currentTrack = state.track_window.current_track;
    this.isPaused = isPaused;

    if (this.changingTrack) return;

    // AMBIENTE -> Detectamos cambio
    if (this.modoReproduccion === 'AMBIENTE') {
      if (this.lastTrackId && currentTrackId !== this.lastTrackId) {
        if (this.colaReproduccion.length > 0) {
          console.log("Cambio en ambiente. Pasando a pedidos...");
          this.resumeTrackUri = currentTrackUri;
          this.procesarSiguientePedido();
        } 
      }
    }

    // PEDIDO -> Canción termina
    if (this.modoReproduccion === 'PEDIDO') {
      if (isPaused && position === 0 && this.lastTrackId === currentTrackId) {
        console.log("Pedido terminado.");
        this.finalizarPedidoActual();
        
        if (this.colaReproduccion.length > 0) {
          this.procesarSiguientePedido();
        } else {
          console.log("Cola vacía. Ambiente.");
          this.reproducirAmbiente();
        }
      }
    }

    this.lastTrackId = currentTrackId;
  }

  reproducirAmbiente() {
    if (!this.deviceId || !this.playlistFondo) return;
    
    this.changingTrack = true;
    this.modoReproduccion = 'AMBIENTE';
    this.cancionSonando = null;

    const offset = this.resumeTrackUri ? this.resumeTrackUri : undefined;

    this.spotifyService.playContext(this.playlistFondo.uri, this.deviceId, this.usuario.id, offset).subscribe({
      next: () => {
        setTimeout(() => {
            this.changingTrack = false;
            this.cdr.detectChanges();
        }, 1000);
      },
      error: () => this.changingTrack = false
    });
  }

  procesarSiguientePedido() {
    if (this.colaReproduccion.length === 0) return;

    this.changingTrack = true;
    const siguienteCancion = this.colaReproduccion[0];
    
    this.modoReproduccion = 'PEDIDO';
    this.cancionSonando = siguienteCancion;
    
    this.spotifyService.playTrack(siguienteCancion.spotifyId, this.deviceId, this.usuario.id).subscribe({
      next: () => {
        this.gramolaService.actualizarEstado(Number(siguienteCancion.id), 'SONANDO').subscribe();
        this.colaReproduccion.shift(); 
        
        setTimeout(() => {
            this.changingTrack = false;
            this.cdr.detectChanges();
        }, 1500);
      },
      error: (e) => {
        console.error("Error reproduciendo pedido", e);
        this.changingTrack = false;
        this.reproducirAmbiente();
      }
    });
  }

  finalizarPedidoActual() {
    if (this.cancionSonando) {
      this.gramolaService.actualizarEstado(Number(this.cancionSonando.id), 'TERMINADA').subscribe();
      this.cancionSonando = null;
    }
  }

  // --- COLA Y BÚSQUEDA ---

  cargarCola() {
    this.gramolaService.obtenerCola(Number(this.usuario.id)).subscribe({
      next: (res: any) => {
        this.ngZone.run(() => {
          if (this.cancionSonando) {
            this.colaReproduccion = res.filter((c: any) => c.id !== this.cancionSonando.id);
          } else {
            this.colaReproduccion = res;
          }
          this.cdr.detectChanges(); // Asegurar refresco en intervalo
        });
      }
    });
  }

  search() {
    if (!this.busqueda || this.busqueda.trim().length <= 2) return;
    this.isSearching = true; 
    this.searchResults = []; 
    
    this.spotifyService.search(this.busqueda, this.usuario.id, 'track').subscribe({
      next: (res: any) => {
        this.ngZone.run(() => {
          if (res && res.tracks && res.tracks.items) {
            this.searchResults = res.tracks.items;
          }
          this.isSearching = false;
          this.cdr.detectChanges(); 
        });
      },
      error: (err) => {
        console.error("Error búsqueda:", err);
        this.isSearching = false;
        this.cdr.detectChanges();
      }
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

  // CIERRE DE PAGO (Aquí actualizamos al añadir)
  onPaymentClosed(success: boolean) {
    this.showPaymentModal = false;
    
    if (success) {
      this.busqueda = '';
      this.searchResults = [];
      
      // Forzamos actualización de cola y vista
      this.ngZone.run(() => {
        this.cargarCola(); 
        this.cdr.detectChanges();
      });
    }
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