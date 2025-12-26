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
  resumeTrackUri: string = ''; 
  
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
  
  // Control de bloqueo por Autoplay
  necesitaInteraccion: boolean = false;
  
  // Precio (se carga de BD)
  precioCancion: number = 0;

  private songStartTime: number = 0;     
  private wasPedido: boolean = false;    

  constructor() {
    const userJson = localStorage.getItem('usuarioBar');
    if (userJson) {
      this.usuario = JSON.parse(userJson);
    } else {
      this.router.navigate(['/login']);
    }

    // FIX F5: Guardar SIEMPRE la canción actual
    window.addEventListener('beforeunload', () => {
        if (this.currentTrack && this.currentTrack.uri) {
            localStorage.setItem('lastTrackUri', this.currentTrack.uri);
        }
    });
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
      this.cargarPrecioCancion();
      
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
        // --- AQUÍ ES DONDE SÍ QUEREMOS VERIFICAR AUTOPLAY (INICIO DE APP) ---
        this.reproducirAmbiente(true); 
      });
    });

    this.player.addListener('player_state_changed', (state: any) => {
      this.ngZone.run(() => {
        this.gestionarCambioDeEstado(state);
      });
    });

    this.player.addListener('initialization_error', ({ message }: any) => console.error(message));
    this.player.addListener('authentication_error', ({ message }: any) => console.error(message));
    this.player.addListener('account_error', ({ message }: any) => console.error(message));

    this.player.connect();
  }

  gestionarCambioDeEstado(state: any) {
    if (!state) return;

    const track = state.track_window.current_track;
    const trackId = track?.id;

    // DETECTAR SALTO MANUAL EN MODO PEDIDO
    if (this.lastTrackId && trackId !== this.lastTrackId && this.modoReproduccion === 'PEDIDO' && !this.changingTrack) {
        console.warn("⚠️ Salto de canción manual detectado. Finalizando pedido actual...");
        this.finalizarPedidoActual(); 
        
        if (this.colaReproduccion.length > 0) {
             this.procesarSiguientePedido();
        } else {
             this.modoReproduccion = 'AMBIENTE';
             if (track.uri && !track.uri.includes('spotify:track')) {
                 this.reproducirAmbiente(); // Aquí NO verificamos autoplay (ya estamos sonando)
             }
        }
    }

    // FIX SALTO DE CANCIÓN
    if (this.modoReproduccion === 'AMBIENTE' && track && track.uri) {
         this.resumeTrackUri = track.uri;
    }

    if (this.modoReproduccion === 'AMBIENTE' && this.colaReproduccion.length > 0 && this.lastTrackId && trackId !== this.lastTrackId) {
        const tiempoSonado = Date.now() - this.songStartTime;
        if (tiempoSonado > 5000 && this.currentTrack) {
             this.agregarAlHistorialVisual(this.currentTrack, 'AMBIENTE');
        }
        if (track && track.uri) {
            this.resumeTrackUri = track.uri;
        }
        this.procesarSiguientePedido();
        return; 
    }

    if (this.currentTrack && trackId !== this.lastTrackId && this.lastTrackId !== '') {
        const tiempoSonado = Date.now() - this.songStartTime;
        if (tiempoSonado > 5000) {
            this.agregarAlHistorialVisual(this.currentTrack, this.wasPedido ? 'PEDIDO' : 'AMBIENTE');
        }
    }
    
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

    if (!this.changingTrack && this.modoReproduccion === 'PEDIDO') {
      if (this.isPaused && this.progressMs === 0 && this.lastTrackId === trackId) {
        this.finalizarPedidoActual();
        if (this.colaReproduccion.length > 0) {
          this.procesarSiguientePedido();
        } else {
          this.reproducirAmbiente(); // Aquí NO verificamos autoplay
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

  // --- MODIFICADO: Acepta parámetro para saber si debe chequear Autoplay ---
  reproducirAmbiente(verificarAutoplay: boolean = false) {
    if (!this.deviceId || !this.playlistFondo) return;
    
    this.changingTrack = true;
    this.modoReproduccion = 'AMBIENTE';
    this.cancionSonando = null;
    
    let offset: string | undefined = this.resumeTrackUri || localStorage.getItem('lastTrackUri') || undefined;
    
    if (offset && !offset.includes('spotify:track:')) {
        offset = undefined;
    }

    this.spotifyService.playContext(this.playlistFondo.uri, this.deviceId, this.usuario.id, offset).subscribe({
      next: () => {
        // Solo verificamos autoplay si nos lo piden (arranque de app)
        if (verificarAutoplay) {
            setTimeout(() => {
                this.player.getCurrentState().then((state: any) => {
                    if (!state || state.paused) {
                        console.warn("⚠️ Autoplay bloqueado. Mostrando botón.");
                        this.ngZone.run(() => {
                            this.necesitaInteraccion = true;
                            this.changingTrack = false;
                            this.cdr.detectChanges();
                        });
                    } else {
                        this.necesitaInteraccion = false;
                        this.resetVariables();
                    }
                });
            }, 1500); // Damos 1.5s para que Spotify reaccione
        } else {
            // Flujo normal (vuelta de pedido), no bloqueamos nada
            this.necesitaInteraccion = false;
            this.resetVariables();
        }
      },
      error: (err) => {
        console.warn("Fallo play:", err);
        // Si falla en el arranque, asumimos bloqueo. Si no, solo log.
        if (verificarAutoplay) {
            this.necesitaInteraccion = true;
        }
        this.changingTrack = false;
        this.cdr.detectChanges();
      }
    });
  }

  activarSonidoManual() {
    this.necesitaInteraccion = false;
    // Al activar manualmente, ya no necesitamos verificar autoplay
    this.reproducirAmbiente(false);
  }

  private resetVariables() {
    setTimeout(() => {
        this.changingTrack = false;
        this.songStartTime = Date.now(); 
        this.wasPedido = false;
        localStorage.removeItem('lastTrackUri'); 
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
        this.necesitaInteraccion = false;
        
        setTimeout(() => {
            this.changingTrack = false;
            this.songStartTime = Date.now();
            this.wasPedido = true;
            this.cdr.detectChanges(); 
        }, 1500);
      },
      error: (e) => {
        console.error("Error al poner pedido:", e);
        this.changingTrack = false;
        this.reproducirAmbiente(); // Sin verificar autoplay
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
      precio: this.precioCancion,
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
    localStorage.removeItem('lastTrackUri');
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