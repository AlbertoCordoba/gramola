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
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private spotifyService = inject(SpotifyConnectService);
  private gramolaService = inject(GramolaService);
  private titleService = inject(Title);
  private http = inject(HttpClient);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private pagoState = inject(PagoStateService);

  usuario: any = null;
  playlistFondo: any = null;

  busqueda: string = '';
  isSearching: boolean = false;
  searchResults: any[] = [];
  
  colaReproduccion: any[] = [];
  historialVisual: any[] = [];

  player: any;
  deviceId: string = '';
  currentTrack: any = null;
  isPaused: boolean = true;
  modoReproduccion: ModoReproduccion = 'AMBIENTE';
  
  cancionSonando: any = null; 
  resumeTrackUri: string = ''; 
  
  progressMs: number = 0;
  durationMs: number = 0;
  progressPercent: number = 0;
  private progressTimer: any;

  showPaymentModal: boolean = false;
  private pollingInterval: any;
  private lastTrackId: string = ''; 
  
  private changingTrack: boolean = false; 
  
  necesitaInteraccion: boolean = false;
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

    // FIX F5: Guardado seguro al cerrar
    window.addEventListener('beforeunload', () => {
        if (this.currentTrack) {
            // Usamos la misma lógica de "URI segura" que en el cambio de estado
            const uriSegura = this.currentTrack.linked_from?.uri || this.currentTrack.uri;
            
            if (uriSegura && !this.changingTrack) {
                localStorage.setItem('lastTrackUri', uriSegura);
                localStorage.setItem('lastModo', this.modoReproduccion);
                
                if (this.modoReproduccion === 'PEDIDO' && this.cancionSonando) {
                    localStorage.setItem('pedidoPendiente', JSON.stringify(this.cancionSonando));
                }
            }
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

    // Recuperación preventiva
    const lastModo = localStorage.getItem('lastModo');
    if (lastModo === 'PEDIDO') {
        this.modoReproduccion = 'PEDIDO';
        this.changingTrack = true; 
    }

    const savedAmbient = localStorage.getItem('ambientResumeUri');
    if (savedAmbient) {
        this.resumeTrackUri = savedAmbient;
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
        console.log('Player ID Ready:', device_id);
        this.deviceId = device_id;
        setTimeout(() => {
            this.restaurarEstado();
        }, 1000); 
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

  restaurarEstado() {
    const lastModo = localStorage.getItem('lastModo');
    const pedidoJson = localStorage.getItem('pedidoPendiente');

    if (lastModo === 'PEDIDO' && pedidoJson) {
        try {
            this.changingTrack = true;
            const pedidoGuardado = JSON.parse(pedidoJson);
            this.modoReproduccion = 'PEDIDO';
            this.cancionSonando = pedidoGuardado;

            console.log("Restaurando pedido:", pedidoGuardado.titulo);

            this.spotifyService.playTrack(pedidoGuardado.spotifyId, this.deviceId, this.usuario.id).subscribe({
                next: () => this.verificarAutoplay(),
                error: (err) => {
                    console.warn("Fallo inicial restaurando, reintentando...", err);
                    setTimeout(() => {
                        this.spotifyService.playTrack(pedidoGuardado.spotifyId, this.deviceId, this.usuario.id).subscribe({
                            next: () => this.verificarAutoplay(),
                            error: () => {
                                console.error("Imposible restaurar pedido. Pidiendo interacción manual.");
                                this.changingTrack = false;
                                this.necesitaInteraccion = true;
                                this.cdr.detectChanges();
                            }
                        });
                    }, 2000);
                }
            });

        } catch (e) {
            console.error("Error recuperando pedido", e);
            this.changingTrack = false;
            this.reproducirAmbiente(true);
        }
    } else {
        this.changingTrack = false;
        this.reproducirAmbiente(true); 
    }
  }

  verificarAutoplay() {
    setTimeout(() => {
        this.player.getCurrentState().then((state: any) => {
            if (!state || state.paused) {
                console.warn("⚠️ Autoplay bloqueado.");
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
    }, 1500);
  }

  gestionarCambioDeEstado(state: any) {
    if (!state) return;

    const track = state.track_window.current_track;
    if (!track) return;

    // --- CORRECCIÓN: Obtener URI original (linked_from) ---
    // Esto es crucial: si Spotify está tocando una versión "linkeada", 
    // la URI normal no servirá para el offset. Necesitamos la original.
    const currentUri = track.linked_from?.uri || track.uri;
    const trackId = track.linked_from?.id || track.id;
    const context = state.context;

    // --- COMPARACIÓN DE PLAYLIST ROBUSTA ---
    // Verificamos si la URI de la playlist está contenida en el contexto actual
    // (Ej: "spotify:playlist:123" está en "spotify:user:juan:playlist:123")
    const esMismaPlaylist = context && this.playlistFondo && 
                            context.uri && this.playlistFondo.uri &&
                            (context.uri === this.playlistFondo.uri || 
                             context.uri.includes(this.playlistFondo.id));

    if (this.modoReproduccion === 'AMBIENTE' && !this.changingTrack && currentUri) {
         if (esMismaPlaylist) {
             this.resumeTrackUri = currentUri;
             localStorage.setItem('ambientResumeUri', currentUri);
         }
    }

    // DETECCIÓN DE SALTO
    if (this.lastTrackId && trackId !== this.lastTrackId && this.modoReproduccion === 'PEDIDO' && !this.changingTrack) {
        this.finalizarPedidoActual(); 
        
        if (this.colaReproduccion.length > 0) {
             this.procesarSiguientePedido();
        } else {
             this.modoReproduccion = 'AMBIENTE';
             localStorage.removeItem('pedidoPendiente');
             
             // Si lo que suena NO es de pago (es decir, ya saltó solo al ambiente o radio),
             // intentamos forzar nuestra playlist.
             if (currentUri && !currentUri.includes('spotify:track')) {
                 this.reproducirAmbiente(); 
             }
        }
    }

    if (this.modoReproduccion === 'AMBIENTE' && this.colaReproduccion.length > 0 && this.lastTrackId && trackId !== this.lastTrackId) {
        const tiempoSonado = Date.now() - this.songStartTime;
        if (tiempoSonado > 5000 && this.currentTrack) {
             this.agregarAlHistorialVisual(this.currentTrack, 'AMBIENTE');
        }
        
        if (currentUri && !this.changingTrack && esMismaPlaylist) {
            this.resumeTrackUri = currentUri;
            localStorage.setItem('ambientResumeUri', currentUri);
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
          localStorage.removeItem('pedidoPendiente'); 
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

  reproducirAmbiente(chequearAutoplay: boolean = false) {
    if (!this.deviceId || !this.playlistFondo) return;
    
    this.changingTrack = true;
    this.modoReproduccion = 'AMBIENTE';
    this.cancionSonando = null;
    localStorage.removeItem('pedidoPendiente');

    let offset: string | undefined = undefined;

    if (this.resumeTrackUri) {
        offset = this.resumeTrackUri;
    } else {
        const savedAmbient = localStorage.getItem('ambientResumeUri');
        if (savedAmbient) {
            offset = savedAmbient;
        } else {
             const storedUri = localStorage.getItem('lastTrackUri');
             const storedModo = localStorage.getItem('lastModo');
             if (storedUri && storedModo === 'AMBIENTE') {
                 offset = storedUri;
             }
        }
    }
    
    if (offset && !offset.includes('spotify:track:')) {
        offset = undefined;
    }

    console.log("Reproduciendo ambiente. Offset:", offset || "INICIO");

    this.spotifyService.playContext(this.playlistFondo.uri, this.deviceId, this.usuario.id, offset).subscribe({
      next: () => {
        if (chequearAutoplay) {
            this.verificarAutoplay();
        } else {
            this.necesitaInteraccion = false;
            this.resetVariables();
        }
      },
      error: (err) => {
        console.warn("Fallo play ambiente con offset:", err);
        
        if (offset) {
             console.log("Fallo offset ambiente. Reiniciando lista...");
             // Limpiamos la memoria corrupta
             localStorage.removeItem('ambientResumeUri'); 
             this.resumeTrackUri = '';

             this.spotifyService.playContext(this.playlistFondo.uri, this.deviceId, this.usuario.id, undefined).subscribe({
                 next: () => this.resetVariables(),
                 error: () => {
                     this.necesitaInteraccion = true;
                     this.changingTrack = false;
                     this.cdr.detectChanges();
                 }
             });
        } else {
            this.necesitaInteraccion = true;
            this.changingTrack = false;
            this.cdr.detectChanges();
        }
      }
    });
  }

  activarSonidoManual() {
    this.necesitaInteraccion = false;
    if (this.modoReproduccion === 'PEDIDO' && this.cancionSonando) {
        this.spotifyService.playTrack(this.cancionSonando.spotifyId, this.deviceId, this.usuario.id).subscribe();
    } else {
        this.reproducirAmbiente(false);
    }
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
    
    localStorage.setItem('pedidoPendiente', JSON.stringify(siguiente));
    localStorage.setItem('lastModo', 'PEDIDO');

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
        this.reproducirAmbiente(); 
      }
    });
  }

  finalizarPedidoActual() {
    if (this.cancionSonando && this.cancionSonando.id) {
      this.gramolaService.actualizarEstado(Number(this.cancionSonando.id), 'TERMINADA').subscribe({
        next: () => {
          this.cancionSonando = null;
          localStorage.removeItem('pedidoPendiente'); 
          this.cargarCola(); 
        }
      });
    } else {
        this.cancionSonando = null;
        localStorage.removeItem('pedidoPendiente');
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
    localStorage.removeItem('lastModo');
    localStorage.removeItem('pedidoPendiente');
    localStorage.removeItem('ambientResumeUri'); 
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