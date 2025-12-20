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
  historialVisual: any[] = [];

  // Reproductor
  player: any;
  deviceId: string = '';
  currentTrack: any = null;
  isPaused: boolean = true;
  modoReproduccion: ModoReproduccion = 'AMBIENTE';
  cancionSonando: any = null; 
  resumeTrackUri: string = ''; // URI para reanudar el ambiente
  
  // Progreso
  progressMs: number = 0;
  durationMs: number = 0;
  progressPercent: number = 0;
  private progressTimer: any;

  // Control
  showPaymentModal: boolean = false;
  private pollingInterval: any;
  private lastTrackId: string = ''; 
  private changingTrack: boolean = false; 
  
  // Precio Dinámico
  precioCancion: number = 0.50; // Valor por defecto

  // Historial y Anti-glitch
  private songStartTime: number = 0;     
  private wasPedido: boolean = false;    

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
      this.cargarCola(); 
      this.cargarPrecioCancion(); // Cargar precio al inicio
      
      this.pollingInterval = setInterval(() => {
        if (!this.changingTrack) {
          this.cargarCola();
        }
      }, 5000);

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

  cargarPrecioCancion() {
    this.gramolaService.obtenerConfiguracionPrecios().subscribe({
      next: (precios: any) => {
        if (precios && precios['PRECIO_CANCION']) {
          this.precioCancion = precios['PRECIO_CANCION'];
        }
      },
      error: (e) => console.error('Error cargando precio canción', e)
    });
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
        console.log('Player ID:', device_id);
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

    // --- LÓGICA DE CAPTURA DE "SIGUIENTE" ---
    // Si estamos en AMBIENTE, queremos que al volver suene la SIGUIENTE a la actual, no la misma.
    if (this.modoReproduccion === 'AMBIENTE') {
        // Intentamos capturar la siguiente en la cola de Spotify
        if (state.track_window.next_tracks && state.track_window.next_tracks.length > 0) {
             this.resumeTrackUri = state.track_window.next_tracks[0].uri;
        } else if (track && track.uri) {
             // Si es la última, nos quedamos con la actual
             this.resumeTrackUri = track.uri;
        }
    }

    // --- INTERCEPTOR (EVITA QUE SUENE LA INTRUSA) ---
    // Si detectamos que la canción cambió pero hay cola pendiente (Transición Ambiente -> Pedido)
    if (this.modoReproduccion === 'AMBIENTE' && this.colaReproduccion.length > 0 && this.lastTrackId && trackId !== this.lastTrackId) {
        
        // 1. Guardar la anterior en historial (solo si sonó > 10s)
        const tiempoSonado = Date.now() - this.songStartTime;
        if (tiempoSonado > 10000 && this.currentTrack) {
             this.agregarAlHistorialVisual(this.currentTrack, 'AMBIENTE');
        }
        
        // 2. IMPORTANTE: En este caso "interceptor", la canción "track" es la que acaba de empezar (la intrusa).
        // Como acaba de empezar, si volvemos a ella, sonará desde el principio. 
        // Así que aquí sobreescribimos resumeTrackUri con la intrusa para no saltárnosla.
        if (track && track.uri) {
            this.resumeTrackUri = track.uri;
        }

        // 3. Cortamos y ponemos el pedido
        this.procesarSiguientePedido();
        return; 
    }

    // --- HISTORIAL NORMAL ---
    if (this.currentTrack && trackId !== this.lastTrackId && this.lastTrackId !== '') {
        const tiempoSonado = Date.now() - this.songStartTime;
        if (tiempoSonado > 10000) {
            this.agregarAlHistorialVisual(this.currentTrack, this.wasPedido ? 'PEDIDO' : 'AMBIENTE');
        }
    }

    // Actualización de datos de la canción actual
    if (trackId !== this.lastTrackId) {
        this.songStartTime = Date.now();
        this.wasPedido = (this.modoReproduccion === 'PEDIDO'); 
        this.gramolaService.actualizarMetadataMultimedia(track);
    }

    this.currentTrack = track;
    this.isPaused = state.paused;
    this.durationMs = state.duration;
    this.progressMs = state.position;
    this.progressPercent = (this.progressMs / this.durationMs) * 100;

    if (this.changingTrack) return;

    // --- FIN DE PEDIDO ---
    if (this.modoReproduccion === 'PEDIDO') {
      // Si se pausa al principio (0ms) significa que terminó
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
    if (this.historialVisual.length > 0 && this.historialVisual[0].titulo === track.name) return; 

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

    // Usamos la URI guardada (que ahora apunta a la SIGUIENTE o a la INTRUSA si hubo corte)
    const offset = (this.resumeTrackUri && this.resumeTrackUri.includes('spotify:track:')) ? this.resumeTrackUri : undefined;

    this.spotifyService.playContext(this.playlistFondo.uri, this.deviceId, this.usuario.id, offset).subscribe({
      next: () => {
        this.resetVariables();
      },
      error: (err) => {
        console.warn("Fallo al reanudar exacto. Reiniciando playlist...", err);
        // Fallback
        this.spotifyService.playContext(this.playlistFondo.uri, this.deviceId, this.usuario.id).subscribe({
            next: () => this.resetVariables(),
            error: () => this.changingTrack = false
        });
      }
    });
  }

  private resetVariables() {
    setTimeout(() => {
        this.changingTrack = false;
        this.songStartTime = Date.now(); 
        this.wasPedido = false;
        this.cdr.detectChanges(); 
    }, 1500);
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
      error: (e) => {
        this.changingTrack = false;
        this.reproducirAmbiente();
      }
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
      precio: this.precioCancion, // Usar precio dinámico
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