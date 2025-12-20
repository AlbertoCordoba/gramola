import { Component, inject, OnDestroy, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
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
  // Inyecciones
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private spotifyService = inject(SpotifyConnectService);
  private gramolaService = inject(GramolaService);
  private titleService = inject(Title);
  private http = inject(HttpClient);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private pagoState = inject(PagoStateService);

  // Estado Usuario
  usuario: any = null;
  playlistFondo: any = null;

  // Buscador
  busqueda: string = '';
  isSearching: boolean = false;
  searchResults: any[] = [];
  
  // Listas
  colaReproduccion: any[] = [];
  historialVisual: any[] = []; // Historial local mixto

  // Reproductor
  player: any;
  deviceId: string = '';
  currentTrack: any = null;
  isPaused: boolean = true;
  modoReproduccion: ModoReproduccion = 'AMBIENTE';
  cancionSonando: any = null; 
  resumeTrackUri: string = ''; 
  
  // Progreso
  progressMs: number = 0;
  durationMs: number = 0;
  progressPercent: number = 0;
  private progressTimer: any;

  // Control de Flujo
  showPaymentModal: boolean = false;
  private pollingInterval: any;
  private lastTrackId: string = ''; 
  private changingTrack: boolean = false; 

  // --- VARIABLES ANTI-GLITCH ---
  private songStartTime: number = 0;     // Momento exacto en que empezó la canción
  private wasPedido: boolean = false;    // Guardamos si ERA pedido al empezar (para el historial)
  // -----------------------------

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

    if (this.usuario) {
      this.initSpotifySDK();
      
      // Carga inicial solo de la cola (Historial empieza limpio para esta sesión)
      this.cargarCola(); 
      
      // Polling de cola (cada 5s)
      this.pollingInterval = setInterval(() => {
        if (!this.changingTrack) {
          this.cargarCola();
        }
      }, 5000);

      // Timer visual de progreso (cada 1s)
      this.progressTimer = setInterval(() => {
        if (!this.isPaused && this.currentTrack) {
          this.progressMs += 1000;
          if (this.progressMs > this.durationMs) this.progressMs = this.durationMs;
          this.progressPercent = (this.progressMs / this.durationMs) * 100;
          this.cdr.detectChanges();
        }
      }, 1000);
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
        console.log('Player Listo ID:', device_id);
        this.deviceId = device_id;
        this.reproducirAmbiente();
      });
    });

    this.player.addListener('player_state_changed', (state: any) => {
      this.ngZone.run(() => {
        this.gestionarCambioDeEstado(state);
      });
    });

    this.player.connect();
  }

  gestionarCambioDeEstado(state: any) {
    if (!state) return;

    const track = state.track_window.current_track;
    const trackId = track?.id;

    // --- 1. INTERCEPTOR DE TRÁFICO (EVITAR GLITCH VISUAL) ---
    // Si estamos en ambiente, hay cola, y la canción ha cambiado...
    if (this.modoReproduccion === 'AMBIENTE' && this.colaReproduccion.length > 0 && this.lastTrackId && trackId !== this.lastTrackId) {
        
        // a) Guardamos la canción ANTERIOR en el historial (la de ambiente que acaba de terminar)
        const tiempoSonado = Date.now() - this.songStartTime;
        if (tiempoSonado > 10000 && this.currentTrack) { // Solo si sonó +10s
             this.agregarAlHistorialVisual(this.currentTrack, 'AMBIENTE');
        }
        
        // b) Forzamos el pedido inmediatamente
        this.resumeTrackUri = track?.uri;
        this.procesarSiguientePedido();

        // c) ¡IMPORTANTE! Retornamos aquí para NO actualizar la vista con la canción "intrusa"
        // La interfaz se quedará congelada en la anterior 1 segundo hasta que cargue la buena.
        return; 
    }

    // --- 2. GESTIÓN NORMAL DE CAMBIO DE CANCIÓN ---
    if (this.currentTrack && trackId !== this.lastTrackId && this.lastTrackId !== '') {
        const tiempoSonado = Date.now() - this.songStartTime;
        // Filtro: Solo al historial si sonó más de 10 segundos
        if (tiempoSonado > 10000) {
            this.agregarAlHistorialVisual(this.currentTrack, this.wasPedido ? 'PEDIDO' : 'AMBIENTE');
        }
    }

    // Si es una canción nueva, reseteamos el cronómetro y el tipo
    if (trackId !== this.lastTrackId) {
        this.songStartTime = Date.now();
        this.wasPedido = (this.modoReproduccion === 'PEDIDO'); // "Foto" del tipo al inicio
        this.gramolaService.actualizarMetadataMultimedia(track);
    }

    // Actualizamos datos de vista
    this.currentTrack = track;
    this.isPaused = state.paused;
    this.durationMs = state.duration;
    this.progressMs = state.position;
    this.progressPercent = (this.progressMs / this.durationMs) * 100;

    if (this.changingTrack) return;

    // --- 3. GESTIÓN FIN DE PEDIDO ---
    if (this.modoReproduccion === 'PEDIDO') {
      // Si se pausa al principio (0ms) y es la misma canción, es que ha terminado y vuelto al inicio
      if (this.isPaused && this.progressMs === 0 && this.lastTrackId === trackId) {
        this.finalizarPedidoActual();
        if (this.colaReproduccion.length > 0) {
          this.procesarSiguientePedido();
        } else {
          this.reproducirAmbiente();
        }
      }
    }

    this.lastTrackId = trackId;
    this.cdr.detectChanges();
  }

  agregarAlHistorialVisual(track: any, tipo: 'PEDIDO' | 'AMBIENTE') {
    if (!track) return;
    
    // Evitar duplicados consecutivos exactos
    if (this.historialVisual.length > 0 && this.historialVisual[0].titulo === track.name) {
        return; 
    }

    const nuevoItem = {
        titulo: track.name,
        artista: track.artists[0].name,
        tipo: tipo 
    };
    
    this.historialVisual.unshift(nuevoItem);
    if (this.historialVisual.length > 5) this.historialVisual.pop();
  }

  reproducirAmbiente() {
    if (!this.deviceId || !this.playlistFondo) return;
    this.changingTrack = true;
    this.modoReproduccion = 'AMBIENTE';
    this.cancionSonando = null;
    const offset = this.resumeTrackUri ? this.resumeTrackUri : undefined;

    this.spotifyService.playContext(this.playlistFondo.uri, this.deviceId, this.usuario.id, offset).subscribe({
      next: () => setTimeout(() => { 
          this.changingTrack = false;
          this.songStartTime = Date.now(); 
          this.wasPedido = false;
          this.cdr.detectChanges(); 
      }, 1500),
      error: () => this.changingTrack = false
    });
  }

  procesarSiguientePedido() {
    if (this.colaReproduccion.length === 0) return;
    this.changingTrack = true;
    const siguiente = this.colaReproduccion[0];
    this.modoReproduccion = 'PEDIDO';
    this.cancionSonando = siguiente;
    
    this.spotifyService.playTrack(siguiente.spotifyId, this.deviceId, this.usuario.id).subscribe({
      next: () => {
        this.gramolaService.actualizarEstado(Number(siguiente.id), 'SONANDO').subscribe();
        this.colaReproduccion.shift(); 
        setTimeout(() => { 
            this.changingTrack = false;
            this.songStartTime = Date.now();
            this.wasPedido = true;
            this.cdr.detectChanges(); 
        }, 1500);
      },
      error: () => { this.changingTrack = false; this.reproducirAmbiente(); }
    });
  }

  finalizarPedidoActual() {
    if (this.cancionSonando) {
      this.gramolaService.actualizarEstado(Number(this.cancionSonando.id), 'TERMINADA').subscribe({
        next: () => {
          this.cancionSonando = null;
          this.cargarCola(); 
        }
      });
    }
  }

  cargarCola() {
    this.gramolaService.obtenerCola(Number(this.usuario.id)).subscribe({
      next: (res: any) => {
        this.ngZone.run(() => {
          // Filtramos para no duplicar la que suena
          if (this.cancionSonando) {
            this.colaReproduccion = res.filter((c: any) => c.id !== this.cancionSonando.id);
          } else {
            this.colaReproduccion = res;
          }
          this.cdr.detectChanges();
        });
      }
    });
  }

  formatTime(ms: number): string {
    if (!ms) return "0:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  search() {
    if (!this.busqueda || this.busqueda.trim().length <= 2) return;
    this.isSearching = true; 
    
    this.spotifyService.search(this.busqueda, this.usuario.id, 'track').subscribe({
      next: (res: any) => {
        this.ngZone.run(() => {
            this.searchResults = res?.tracks?.items || [];
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
      this.cargarCola();
    }
  }

  logout() {
    localStorage.removeItem('usuarioBar');
    localStorage.removeItem('playlistFondo');
    this.player?.disconnect();
    this.router.navigate(['/login']);
  }

  ngOnDestroy() {
    if (this.player) this.player.disconnect();
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    if (this.progressTimer) clearInterval(this.progressTimer);
    this.titleService.setTitle('Gramola'); 
  }
}