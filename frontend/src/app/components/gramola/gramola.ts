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

// Interfaz para los elementos visuales de la cola
interface ItemCola {
  titulo: string;
  artista: string;
  imagen?: string;
  tipo: 'PEDIDO' | 'AMBIENTE';
  id?: string;
}

@Component({
  selector: 'app-gramola',
  standalone: true,
  imports: [CommonModule, FormsModule, PasarelaPagoComponent],
  templateUrl: './gramola.html',
  styleUrl: './gramola.css'
})
export class Gramola implements OnInit, OnDestroy {
  // --- INYECCIONES ---
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private spotifyService = inject(SpotifyConnectService);
  private gramolaService = inject(GramolaService);
  private titleService = inject(Title);
  private http = inject(HttpClient);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private pagoState = inject(PagoStateService);

  // --- DATOS BÁSICOS ---
  usuario: any = null;
  playlistFondo: any = null;

  // --- BUSCADOR ---
  busqueda: string = '';
  isSearching: boolean = false;
  searchResults: any[] = [];
  
  // --- ESTADO DE DATOS ---
  colaReproduccion: any[] = [];   // Pedidos desde BD
  siguientesSpotify: any[] = [];  // Next tracks desde SDK
  tracksRespaldo: any[] = [];     // Playlist completa desde API
  
  // --- ESTADO VISUAL ---
  colaVisual: ItemCola[] = [];
  historialVisual: any[] = [];

  // --- PLAYER & PLAYBACK ---
  player: any;
  deviceId: string = '';
  currentTrack: any = null;
  isPaused: boolean = true;
  modoReproduccion: 'AMBIENTE' | 'PEDIDO' = 'AMBIENTE';
  
  cancionSonando: any = null;  // Datos del pedido actual
  resumeTrackUri: string = ''; // URI para retomar ambiente
  
  // --- PROGRESO ---
  progressMs: number = 0;
  durationMs: number = 0;
  progressPercent: number = 0;
  private progressTimer: any;

  // --- CONTROL ---
  showPaymentModal: boolean = false;
  private pollingInterval: any;
  private lastTrackId: string = ''; 
  private changingTrack: boolean = false; 
  necesitaInteraccion: boolean = false; // Controla el aviso de "Reanudar con F5/Click"
  precioCancion: number = 0;

  // --- METADATOS INTERNOS ---
  private songStartTime: number = 0;     
  private wasPedido: boolean = false;    

  constructor() {
    const userJson = localStorage.getItem('usuarioBar');
    if (userJson) {
      this.usuario = JSON.parse(userJson);
    } else {
      this.router.navigate(['/login']);
    }

    // Persistencia básica al cerrar/recargar
    window.addEventListener('beforeunload', () => {
        if (this.currentTrack) {
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
    // 1. Cargar Playlist de Fondo
    const plGuardada = localStorage.getItem('playlistFondo');
    if (plGuardada) {
        this.playlistFondo = JSON.parse(plGuardada);
        this.cargarTracksDeRespaldo(); // Carga inmediata de la lista completa
    } else {
        this.router.navigate(['/config-audio']);
        return;
    }

    // 2. Recuperar estado (si venimos de F5)
    const lastModo = localStorage.getItem('lastModo');
    if (lastModo === 'PEDIDO') {
        this.modoReproduccion = 'PEDIDO';
        this.changingTrack = true; 
    }

    const savedAmbient = localStorage.getItem('ambientResumeUri');
    if (savedAmbient) {
        this.resumeTrackUri = savedAmbient;
    }

    // 3. Iniciar lógica
    if (this.usuario) {
      this.initSpotifySDK();
      this.cargarCola(); 
      this.cargarPrecioCancion();
      
      // Polling de pedidos
      this.pollingInterval = setInterval(() => {
        if (!this.changingTrack) {
          this.cargarCola();
        }
      }, 5000);

      // Timer de la barra
      this.progressTimer = setInterval(() => {
        if (!this.isPaused && this.currentTrack) {
          this.progressMs += 1000;
          if (this.progressMs > this.durationMs) this.progressMs = this.durationMs;
          if (this.durationMs > 0) {
              this.progressPercent = (this.progressMs / this.durationMs) * 100;
          }
          this.cdr.detectChanges();
        }
      }, 1000);
    }
  }

  // --- CARGA DE DATOS DE RESPALDO ---
  cargarTracksDeRespaldo() {
    if (!this.playlistFondo?.id) return;
    
    this.spotifyService.getPlaylist(this.playlistFondo.id, this.usuario.id).subscribe({
      next: (res: any) => {
        if (res.tracks && res.tracks.items) {
          this.tracksRespaldo = res.tracks.items
            .map((item: any) => item.track)
            .filter((t: any) => t && t.id);
          
          this.actualizarColaVisual();
        }
      },
      error: (e) => console.error("Error cargando respaldo:", e)
    });
  }

  // --- HELPERS PARA BÚSQUEDA ROBUSTA ---
  
  // Genera una clave única "titulo|artista" para comparar
  private getTrackKey(titulo: string, artista: string): string {
    return `${titulo?.toLowerCase().trim().replace(/[^a-z0-9]/g, '')}|${artista?.toLowerCase().trim().replace(/[^a-z0-9]/g, '')}`;
  }

  // Encuentra el índice de una canción en el respaldo usando ID, URI o Nombre+Artista
  private encontrarIndiceSeguro(trackId: string, trackUri: string, trackName: string, trackArtist: string): number {
    if (!this.tracksRespaldo || this.tracksRespaldo.length === 0) return -1;

    // 1. Intento exacto por ID
    let idx = this.tracksRespaldo.findIndex(t => t.id === trackId);
    if (idx !== -1) return idx;

    // 2. Intento exacto por URI
    if (trackUri) {
        idx = this.tracksRespaldo.findIndex(t => t.uri === trackUri);
        if (idx !== -1) return idx;
    }

    // 3. Intento "borroso" por Nombre y Artista (Infalible para versiones re-linkeadas)
    const keyBuscada = this.getTrackKey(trackName, trackArtist);
    idx = this.tracksRespaldo.findIndex(t => 
        this.getTrackKey(t.name, t.artists[0]?.name) === keyBuscada
    );

    return idx;
  }

  // ==========================================
  // LÓGICA DE LA COLA VISUAL CORREGIDA
  // ==========================================
  actualizarColaVisual() {
    const listaFinal: ItemCola[] = [];
    const MINIMO_CANCIONES = 5;
    const clavesAgregadas = new Set<string>();

    // 0. Datos de la canción actual
    let currentId = '';
    let currentKey = '';
    if (this.currentTrack) {
        currentId = this.currentTrack.linked_from?.id || this.currentTrack.id;
        const nombre = this.currentTrack.name;
        const artista = this.currentTrack.artists[0]?.name;
        currentKey = this.getTrackKey(nombre, artista);
        clavesAgregadas.add(currentKey); 
    }

    // 1. AÑADIR PEDIDOS (Prioridad)
    this.colaReproduccion.forEach(p => {
      const key = this.getTrackKey(p.titulo, p.artista);
      // Evitamos añadir si es la que está sonando
      if (p.spotifyId !== currentId && !clavesAgregadas.has(key)) {
          listaFinal.push({
            titulo: p.titulo,
            artista: p.artista,
            tipo: 'PEDIDO',
            id: p.spotifyId,
            imagen: p.imagenUrl 
          });
          clavesAgregadas.add(key);
      }
    });

    // 2. RELLENAR CON AMBIENTE
    if (listaFinal.length < MINIMO_CANCIONES) {
        
        let candidatosAmbiente: any[] = [];

        // A) SDK Spotify (Prioridad en modo Ambiente puro si hay datos válidos)
        if (this.modoReproduccion === 'AMBIENTE' && this.siguientesSpotify.length > 0) {
            candidatosAmbiente = [...this.siguientesSpotify];
        } 
        
        // B) Respaldo Playlist (Calculado con la nueva función robusta)
        if (candidatosAmbiente.length < MINIMO_CANCIONES && this.tracksRespaldo.length > 0) {
            
            let refId = '', refUri = '', refName = '', refArtist = '';
            let usarReferenciaGuardada = true; // Por defecto asumimos que usaremos la guardada

            // <--- CORRECCIÓN PRINCIPAL AQUÍ --->
            // Si estamos en AMBIENTE y hay un track sonando, verificamos si es de la lista de respaldo.
            // Si NO está en el respaldo (es el track de pago que termina), lo ignoramos.
            if (this.modoReproduccion === 'AMBIENTE' && this.currentTrack) {
                const testIdx = this.encontrarIndiceSeguro(
                    currentId, 
                    this.currentTrack.uri, 
                    this.currentTrack.name, 
                    this.currentTrack.artists[0]?.name
                );

                // Si encontramos el track en el respaldo, es seguro usarlo como referencia
                if (testIdx !== -1) {
                    refId = currentId;
                    refUri = this.currentTrack.uri;
                    refName = this.currentTrack.name;
                    refArtist = this.currentTrack.artists[0]?.name;
                    usarReferenciaGuardada = false;
                }
                // Si testIdx es -1, significa que currentTrack es la canción de pago "fantasma".
                // Dejamos usarReferenciaGuardada en true.
            }

            // Si decidimos usar la referencia guardada (porque era Pedido o transición sucia)
            if (usarReferenciaGuardada) {
                const uri = this.resumeTrackUri || localStorage.getItem('ambientResumeUri');
                if (uri) {
                    refUri = uri;
                    const partes = uri.split(':');
                    refId = partes[partes.length - 1];
                    const trackGuardado = this.tracksRespaldo.find(t => t.id === refId);
                    if (trackGuardado) {
                        refName = trackGuardado.name;
                        refArtist = trackGuardado.artists[0]?.name;
                    }
                }
            }

            // Usamos la función robusta para encontrar el índice
            let indice = this.encontrarIndiceSeguro(refId, refUri, refName, refArtist);
            
            // Si no se encuentra, empezamos desde el principio
            if (indice === -1) indice = 0;

            // <--- AJUSTE DE OFFSET --->
            // - Si estamos en PEDIDO o usando Referencia Guardada (transición): Offset 0 (queremos ver 'esa' canción)
            // - Si estamos en AMBIENTE REAL (usarReferenciaGuardada = false): Offset 1 (queremos la siguiente)
            let inicioOffset = (this.modoReproduccion === 'PEDIDO' || usarReferenciaGuardada) ? 0 : 1;

            // Cogemos candidatos del respaldo (Circular)
            for (let i = inicioOffset; i <= 20; i++) {
                const nextIndex = (indice + i) % this.tracksRespaldo.length;
                candidatosAmbiente.push(this.tracksRespaldo[nextIndex]);
            }
        }

        // C) Volcar candidatos filtrando
        for (const track of candidatosAmbiente) {
            if (listaFinal.length >= MINIMO_CANCIONES) break;
            
            const nombre = track.name;
            const artista = track.artists[0]?.name;
            const key = this.getTrackKey(nombre, artista);

            // Filtro Maestro: Ni la que suena, ni repetidas
            if (clavesAgregadas.has(key)) continue;
            if (track.id === currentId) continue;

            listaFinal.push({
                titulo: nombre,
                artista: artista,
                tipo: 'AMBIENTE',
                id: track.id,
                imagen: track.album?.images[0]?.url || track.album?.images[1]?.url
            });
            clavesAgregadas.add(key);
        }
    }

    this.colaVisual = listaFinal;
    this.cdr.detectChanges();
  }

  cargarPrecioCancion() {
    this.gramolaService.obtenerConfiguracionPrecios().subscribe({
      next: (precios: any) => {
        if (precios && precios['PRECIO_CANCION']) {
          this.precioCancion = precios['PRECIO_CANCION'];
        }
      },
      error: (e) => console.error('Error cargando precio', e)
    });
  }

  // --- SPOTIFY INIT & CONNECT ---
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
        // Restaurar estado tras 1s
        setTimeout(() => this.restaurarEstado(), 1000); 
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

  // --- RESTAURAR ESTADO (F5) ---
  restaurarEstado() {
    const lastModo = localStorage.getItem('lastModo');
    const pedidoJson = localStorage.getItem('pedidoPendiente');

    if (lastModo === 'PEDIDO' && pedidoJson) {
        try {
            this.changingTrack = true;
            const pedidoGuardado = JSON.parse(pedidoJson);
            this.modoReproduccion = 'PEDIDO';
            this.cancionSonando = pedidoGuardado;
            
            this.spotifyService.playTrack(pedidoGuardado.spotifyId, this.deviceId, this.usuario.id).subscribe({
                next: () => this.verificarAutoplay(),
                error: (err) => {
                    setTimeout(() => {
                        this.spotifyService.playTrack(pedidoGuardado.spotifyId, this.deviceId, this.usuario.id).subscribe({
                            next: () => this.verificarAutoplay(),
                            error: () => {
                                this.changingTrack = false;
                                this.necesitaInteraccion = true;
                                this.cdr.detectChanges();
                            }
                        });
                    }, 2000);
                }
            });
        } catch (e) {
            this.changingTrack = false;
            this.reproducirAmbiente(true);
        }
    } else {
        this.changingTrack = false;
        this.reproducirAmbiente(true); 
    }
  }

  // --- CHEQUEO DE AUTOPLAY (VENTANA DE AVISO) ---
  verificarAutoplay() {
    setTimeout(() => {
        this.player.getCurrentState().then((state: any) => {
            // Si no hay estado o está pausado -> Bloqueado
            if (!state || state.paused) {
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
    }, 2000);
  }

  // --- CAMBIO DE ESTADO (TRACKS) ---
  gestionarCambioDeEstado(state: any) {
    if (!state) return;
    const track = state.track_window.current_track;
    if (!track) return;

    if (state.track_window && state.track_window.next_tracks) {
      this.siguientesSpotify = state.track_window.next_tracks;
    } else {
      this.siguientesSpotify = [];
    }

    const currentUri = track.linked_from?.uri || track.uri;
    const trackId = track.linked_from?.id || track.id;
    const context = state.context;
    
    // Verificamos si estamos en la playlist de ambiente
    const esMismaPlaylist = context && this.playlistFondo && context.uri && this.playlistFondo.uri &&
                            (context.uri === this.playlistFondo.uri || context.uri.includes(this.playlistFondo.id));

    if (this.modoReproduccion === 'AMBIENTE' && !this.changingTrack && currentUri) {
         if (esMismaPlaylist) {
             this.resumeTrackUri = currentUri;
             localStorage.setItem('ambientResumeUri', currentUri);
         }
    }

    // Salto de Pedido a Ambiente
    if (this.lastTrackId && trackId !== this.lastTrackId && this.modoReproduccion === 'PEDIDO' && !this.changingTrack) {
        this.finalizarPedidoActual(); 
        if (this.colaReproduccion.length > 0) {
             this.procesarSiguientePedido();
        } else {
             this.modoReproduccion = 'AMBIENTE';
             localStorage.removeItem('pedidoPendiente');
             // Forzamos ambiente
             this.reproducirAmbiente(); 
        }
    }

    if (this.modoReproduccion === 'AMBIENTE' && this.colaReproduccion.length > 0 && this.lastTrackId && trackId !== this.lastTrackId) {
        if (Date.now() - this.songStartTime > 5000 && this.currentTrack) {
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
        if (Date.now() - this.songStartTime > 5000) {
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
    this.actualizarColaVisual(); // Refrescar visual
    this.cdr.detectChanges();
  }

  agregarAlHistorialVisual(track: any, tipo: 'PEDIDO' | 'AMBIENTE') {
    if (!track) return;
    if (this.historialVisual.length > 0 && this.historialVisual[0].titulo === track.name) return; 
    this.historialVisual.unshift({ titulo: track.name, artista: track.artists[0].name, tipo: tipo });
    if (this.historialVisual.length > 5) this.historialVisual.pop();
  }

  reproducirAmbiente(chequearAutoplay: boolean = false) {
    if (!this.deviceId || !this.playlistFondo) return;
    this.changingTrack = true;
    this.modoReproduccion = 'AMBIENTE';
    this.cancionSonando = null;
    localStorage.removeItem('pedidoPendiente');

    let offset: string | undefined = undefined;
    if (this.resumeTrackUri) offset = this.resumeTrackUri;
    else if (localStorage.getItem('ambientResumeUri')) offset = localStorage.getItem('ambientResumeUri') || undefined;
    if (offset && !offset.includes('spotify:track:')) offset = undefined;

    this.spotifyService.playContext(this.playlistFondo.uri, this.deviceId, this.usuario.id, offset).subscribe({
      next: () => {
        if (chequearAutoplay) this.verificarAutoplay();
        else this.resetVariables();
      },
      error: (err) => {
        if (offset) {
             localStorage.removeItem('ambientResumeUri'); 
             this.resumeTrackUri = '';
             this.spotifyService.playContext(this.playlistFondo.uri, this.deviceId, this.usuario.id, undefined).subscribe({
                 next: () => {
                    // Chequear autoplay tras reintento
                    if (chequearAutoplay) this.verificarAutoplay();
                    else this.resetVariables();
                 },
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
        this.necesitaInteraccion = false;
        setTimeout(() => {
            this.changingTrack = false;
            this.songStartTime = Date.now();
            this.wasPedido = true;
            this.actualizarColaVisual();
            this.cdr.detectChanges(); 
        }, 1500);
      },
      error: () => { this.changingTrack = false; this.reproducirAmbiente(); }
    });
  }

  finalizarPedidoActual() {
    if (this.cancionSonando?.id) {
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
            this.colaReproduccion = res.filter((c: any) => String(c.id) !== String(this.cancionSonando.id));
          } else {
            this.colaReproduccion = res;
          }
          this.actualizarColaVisual();
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
        imagenUrl: track.album?.images[0]?.url || '',
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
    localStorage.clear();
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