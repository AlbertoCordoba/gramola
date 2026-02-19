/*
 * ======================================================================================
 * COMPONENTE PRINCIPAL: GRAMOLA (Reproductor Inteligente)
 * ======================================================================================
 */

import { Component, inject, OnDestroy, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, filter, switchMap, tap, finalize, catchError, startWith } from 'rxjs/operators';
import { of, Subscription, interval } from 'rxjs';

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
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PasarelaPagoComponent],
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
  searchControl = new FormControl('');
  isSearching: boolean = false;
  searchResults: any[] = [];
  
  colaReproduccion: any[] = [];
  siguientesSpotify: any[] = [];
  tracksRespaldo: any[] = [];
  
  colaVisual: ItemCola[] = [];
  historialVisual: any[] = [];

  player: any;
  deviceId: string = '';
  currentTrack: any = null;
  isPaused: boolean = true;
  
  modoReproduccion: 'AMBIENTE' | 'PEDIDO' = 'AMBIENTE';
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

  // --- GESTIÓN DE DISPOSITIVOS ---
  devices: any[] = [];
  currentDevice: any;
  deviceError? : string;
  private deviceSubscription?: Subscription;
  // CONSTRUCTOR: Recupera la sesión del bar y añade un listener para guardar el estado crítico (modo y canción) en el LocalStorage si el usuario intenta cerrar o recargar la pestaña.
  constructor() {
    const userJson = localStorage.getItem('usuarioBar');
    if (userJson) {
      this.usuario = JSON.parse(userJson);
    } else {
      this.router.navigate(['/login']);
    }

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

  // MÉTODO DE INICIO: Recupera la sesión, la playlist de fondo y arranca el SDK de Spotify.
  ngOnInit() {
    const plGuardada = localStorage.getItem('playlistFondo');
    if (plGuardada) {
        this.playlistFondo = JSON.parse(plGuardada);
        this.cargarTracksDeRespaldo(); 
    } else {
        this.router.navigate(['/config-audio']);
        return;
    }

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
      this.setupLiveSearch();
      this.startAutoRefreshDevices();

      this.pollingInterval = setInterval(() => {
        if (!this.changingTrack) {
          this.cargarCola();
        }
      }, 5000);

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

  // startAutoRefreshDevices: Hilo reactivo que consulta cada 5s los dispositivos disponibles en la cuenta de Spotify del bar para mantener la lista de salida de audio actualizada.
  startAutoRefreshDevices() {
    this.deviceSubscription = interval(5000)
      .pipe(
        startWith(0),
        switchMap(() => this.spotifyService.getDevices(this.usuario.id).pipe(
          catchError(err => {
            console.error('Error auto-refresh devices', err);
            return of({ devices: [] });
          })
        ))
      )
      .subscribe({
        next: (result: any) => {
          this.devices = result.devices;
          this.currentDevice = this.devices.find((d: any) => d.is_active);
          if (this.devices.length > 0) this.deviceError = undefined;
          this.cdr.detectChanges();
        }
      });
  }
  // setupLiveSearch: Configura el buscador reactivo de Spotify con 'debounceTime' para no saturar la API mientras el usuario escribe su búsqueda.
  setupLiveSearch() {
    this.searchControl.valueChanges.pipe(
      filter(text => (text || '').trim().length > 0),
      debounceTime(300),
      distinctUntilChanged(),
      tap(() => {
        this.ngZone.run(() => {
          this.isSearching = true;
          this.cdr.detectChanges();
        });
      }),
      switchMap(text => {
        return this.spotifyService.search(text!, this.usuario.id, 'track').pipe(
          catchError(err => {
            console.error('Error en búsqueda Spotify:', err);
            return of(null);
          }),
          finalize(() => {})
        );
      })
    ).subscribe({
      next: (res: any) => {
        this.ngZone.run(() => {
          this.isSearching = false;
          if (res && res.tracks) {
            this.searchResults = res.tracks.items || [];
          } else {
            this.searchResults = []; 
          }
          this.cdr.detectChanges();
        });
      },
      error: (err: any) => {
        console.error("Error crítico en buscador:", err);
        this.isSearching = false;
      }
    });
  }
  // cargarTracksDeRespaldo: Descarga la lista completa de canciones de la playlist de ambiente para tenerlas listas como "relleno" visual en la interfaz.
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
      error: (e: any) => console.error("Error cargando respaldo:", e)
    });
  }
  // getTrackKey: Genera una clave única normalizada (título|artista) para identificar canciones y evitar duplicados visuales en la cola.
  private getTrackKey(titulo: string, artista: string): string {
    return `${titulo?.toLowerCase().trim().replace(/[^a-z0-9]/g, '')}|${artista?.toLowerCase().trim().replace(/[^a-z0-9]/g, '')}`;
  }
  // encontrarIndiceSeguro: Localiza una canción en la lista de respaldo comparando IDs, URIs o metadatos para asegurar la continuidad de la música de ambiente.
  private encontrarIndiceSeguro(trackId: string, trackUri: string, trackName: string, trackArtist: string): number {
    if (!this.tracksRespaldo || this.tracksRespaldo.length === 0) return -1;
    let idx = this.tracksRespaldo.findIndex(t => t.id === trackId);
    if (idx !== -1) return idx;
    if (trackUri) {
        idx = this.tracksRespaldo.findIndex(t => t.uri === trackUri);
        if (idx !== -1) return idx;
    }
    const keyBuscada = this.getTrackKey(trackName, trackArtist);
    idx = this.tracksRespaldo.findIndex(t => 
        this.getTrackKey(t.name, t.artists[0]?.name) === keyBuscada
    );
    return idx;
  }
  // actualizarColaVisual: Algoritmo de mezcla. Construye la lista que ve el bar combinando los pedidos pagados con las próximas pistas de la lista de ambiente.
  actualizarColaVisual() {
    const listaFinal: ItemCola[] = [];
    const MINIMO_CANCIONES = 5;
    const clavesAgregadas = new Set<string>();

    let currentId = '';
    let currentKey = '';
    if (this.currentTrack) {
        currentId = this.currentTrack.linked_from?.id || this.currentTrack.id;
        const nombre = this.currentTrack.name;
        const artista = this.currentTrack.artists[0]?.name;
        currentKey = this.getTrackKey(nombre, artista);
        clavesAgregadas.add(currentKey); 
    }

    this.colaReproduccion.forEach(p => {
      const key = this.getTrackKey(p.titulo, p.artista);
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

    if (listaFinal.length < MINIMO_CANCIONES) {
        let candidatosAmbiente: any[] = [];
        if (this.modoReproduccion === 'AMBIENTE' && this.siguientesSpotify.length > 0) {
            candidatosAmbiente = [...this.siguientesSpotify];
        } 
        if (candidatosAmbiente.length < MINIMO_CANCIONES && this.tracksRespaldo.length > 0) {
            let refId = '', refUri = '', refName = '', refArtist = '';
            let usarReferenciaGuardada = true;
            if (this.modoReproduccion === 'AMBIENTE' && this.currentTrack) {
                const testIdx = this.encontrarIndiceSeguro(
                    currentId, 
                    this.currentTrack.uri, 
                    this.currentTrack.name, 
                    this.currentTrack.artists[0]?.name
                );
                if (testIdx !== -1) {
                    refId = currentId;
                    refUri = this.currentTrack.uri;
                    refName = this.currentTrack.name;
                    refArtist = this.currentTrack.artists[0]?.name;
                    usarReferenciaGuardada = false;
                }
            }
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
            let indice = this.encontrarIndiceSeguro(refId, refUri, refName, refArtist);
            if (indice === -1) indice = 0;
            let inicioOffset = (this.modoReproduccion === 'PEDIDO' || usarReferenciaGuardada) ? 0 : 1;
            for (let i = inicioOffset; i <= 20; i++) {
                const nextIndex = (indice + i) % this.tracksRespaldo.length;
                candidatosAmbiente.push(this.tracksRespaldo[nextIndex]);
            }
        }
        for (const track of candidatosAmbiente) {
            if (listaFinal.length >= MINIMO_CANCIONES) break;
            const nombre = track.name;
            const artista = track.artists[0]?.name;
            const key = this.getTrackKey(nombre, artista);
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
  // cargarPrecioCancion: Consulta en el servidor el coste actual de pedir una canción para configurar correctamente la pasarela de pago.
  cargarPrecioCancion() {
    this.http.get<any>('http://localhost:8080/api/bares/precios').subscribe({
      next: (precios: any) => {
        if (precios && precios['PRECIO_CANCION']) {
          this.precioCancion = precios['PRECIO_CANCION'];
          console.log('✅ Precio actualizado:', this.precioCancion);
        }
      },
      error: (e: any) => console.error('Error cargando precio', e)
    });
  }
  // getDevices: Realiza una petición manual para listar los dispositivos disponibles (móvil, PC, etc.) y detecta cuál es el dispositivo activo actualmente.
  getDevices() {
    this.deviceError = undefined;
    this.isSearching = true;
    this.spotifyService.getDevices(this.usuario.id).subscribe({
      next: (result: any) => {
        this.devices = result.devices;
        this.currentDevice = this.devices.find((d: any) => d.is_active);
        if (!this.currentDevice) this.deviceError = "No hay ningún dispositivo conectado";
        this.isSearching = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.deviceError = err.message;
        this.isSearching = false;
      }
    });
  }
// initSpotifySDK: Inyecta el script oficial de Spotify en el HTML si no existe y espera a que esté listo para conectar.
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
  // requestTokenAndConnect: Solicita un token de acceso fresco al backend y, al recibirlo, procede a inicializar el reproductor con las credenciales del bar.
  requestTokenAndConnect() {
    this.spotifyService.getToken(this.usuario.id).subscribe({
      next: (res: any) => {
        if (res.access_token) this.initializePlayer(res.access_token);
      }
    });
  }
  // initializePlayer: Configura el 'Gramola Virtual Player', define su volumen y registra los listeners de eventos para reaccionar a cambios de estado o errores de conexión.
  initializePlayer(token: string) {
    this.player = new window.Spotify.Player({
      name: 'Gramola Virtual Player',
      getOAuthToken: (cb: any) => cb(token),
      volume: 0.5
    });

    this.player.addListener('ready', ({ device_id }: any) => {
      this.ngZone.run(() => {
        this.deviceId = device_id;
        setTimeout(() => this.restaurarEstado(), 1000); 
      });
    });

    this.player.addListener('player_state_changed', (state: any) => {
      this.ngZone.run(() => this.gestionarCambioDeEstado(state));
    });

    this.player.addListener('initialization_error', ({ message }: any) => console.error(message));
    this.player.addListener('authentication_error', ({ message }: any) => console.error(message));
    this.player.addListener('account_error', ({ message }: any) => console.error(message));

    this.player.connect();
  }
  // restaurarEstado: Al iniciar, verifica si había un 'PEDIDO' sonando antes de cerrar la sesión para intentar reanudarlo inmediatamente sin perder la posición.
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
                error: () => {
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
  // verificarAutoplay: Comprueba si la política del navegador ha bloqueado el sonido automático y, si es así, activa el aviso visual para el usuario.
  verificarAutoplay() {
    setTimeout(() => {
        this.player.getCurrentState().then((state: any) => {
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
  // gestionarCambioDeEstado: El núcleo lógico. Detecta el fin de una canción, gestiona el historial visual y decide si debe saltar al siguiente pedido pagado o seguir con el ambiente.
  gestionarCambioDeEstado(state: any) {
    if (!state) return;
    const isFinished = state.paused && state.position === 0 && state.track_window.next_tracks.length === 0;
    if (isFinished && !this.changingTrack) {
        this.finalizarPedidoActual(); 
        if (this.colaReproduccion.length > 0) this.procesarSiguientePedido();
        else this.reproducirAmbiente();
        return;
    }
    const track = state.track_window.current_track;
    if (!track) return;
    this.siguientesSpotify = state.track_window.next_tracks || [];
    const currentUri = track.linked_from?.uri || track.uri;
    const trackId = track.linked_from?.id || track.id;
    const context = state.context;
    const esMismaPlaylist = context && this.playlistFondo && context.uri && this.playlistFondo.uri &&
                            (context.uri === this.playlistFondo.uri || context.uri.includes(this.playlistFondo.id));

    if (this.modoReproduccion === 'AMBIENTE' && !this.changingTrack && currentUri && esMismaPlaylist) {
        this.resumeTrackUri = currentUri;
        localStorage.setItem('ambientResumeUri', currentUri);
    }
    if (this.lastTrackId && trackId !== this.lastTrackId && this.modoReproduccion === 'PEDIDO' && !this.changingTrack) {
        this.finalizarPedidoActual(); 
        if (this.colaReproduccion.length > 0) this.procesarSiguientePedido();
        else {
             this.modoReproduccion = 'AMBIENTE';
             localStorage.removeItem('pedidoPendiente');
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
    if (this.durationMs > 0) this.progressPercent = (this.progressMs / this.durationMs) * 100;
    if (!this.changingTrack && this.modoReproduccion === 'PEDIDO' && this.isPaused && this.progressMs === 0 && this.lastTrackId === trackId) {
        this.finalizarPedidoActual();
        if (this.colaReproduccion.length > 0) this.procesarSiguientePedido();
        else {
          localStorage.removeItem('pedidoPendiente'); 
          this.reproducirAmbiente(); 
        }
    }
    this.lastTrackId = trackId;
    this.actualizarColaVisual();
    this.cdr.detectChanges();
  }
  // agregarAlHistorialVisual: Añade dinámicamente la última canción reproducida a la lista de "Recién sonadas" para dar feedback al local.
  agregarAlHistorialVisual(track: any, tipo: 'PEDIDO' | 'AMBIENTE') {
    if (!track) return;
    if (this.historialVisual.length > 0 && this.historialVisual[0].titulo === track.name) return; 
    this.historialVisual.unshift({ titulo: track.name, artista: track.artists[0].name, tipo: tipo });
    if (this.historialVisual.length > 5) this.historialVisual.pop();
  }
  // reproducirAmbiente: Envía la orden de reproducir la playlist de fondo del local, intentando retomar la música desde la última posición guardada ('offset').
  reproducirAmbiente(chequearAutoplay: boolean = false) {
    if (!this.deviceId || !this.playlistFondo) return;
    this.changingTrack = true;
    this.modoReproduccion = 'AMBIENTE';
    this.cancionSonando = null;
    localStorage.removeItem('pedidoPendiente');
    let offset = this.resumeTrackUri || localStorage.getItem('ambientResumeUri') || undefined;
    if (offset && !offset.includes('spotify:track:')) offset = undefined;
    this.spotifyService.playContext(this.playlistFondo.uri, this.deviceId, this.usuario.id, offset).subscribe({
      next: () => chequearAutoplay ? this.verificarAutoplay() : this.resetVariables(),
      error: () => {
        if (offset) {
             localStorage.removeItem('ambientResumeUri'); 
             this.resumeTrackUri = '';
             this.spotifyService.playContext(this.playlistFondo.uri, this.deviceId, this.usuario.id, undefined).subscribe({
                 next: () => chequearAutoplay ? this.verificarAutoplay() : this.resetVariables(),
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
  // activarSonidoManual: Método de auxilio para el usuario; permite arrancar la reproducción manualmente si el autoplay fue bloqueado por el navegador.
  activarSonidoManual() {
    this.necesitaInteraccion = false;
    if (this.modoReproduccion === 'PEDIDO' && this.cancionSonando) {
        this.spotifyService.playTrack(this.cancionSonando.spotifyId, this.deviceId, this.usuario.id).subscribe();
    } else {
        this.reproducirAmbiente(false);
    }
  }
  // resetVariables: Reinicia los flags de control interno tras un cambio de canción para preparar el sistema para el siguiente evento.
  private resetVariables() {
    setTimeout(() => {
        this.changingTrack = false;
        this.songStartTime = Date.now(); 
        this.wasPedido = false;
        this.cdr.detectChanges(); 
    }, 1500);
  }
  // procesarSiguientePedido: Extrae la canción prioritaria de la cola de pagos, la pone a sonar y notifica al Backend que ha pasado al estado 'SONANDO'.
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
      error: () => { 
        this.changingTrack = false; 
        this.reproducirAmbiente(); 
      }
    });
  }
  // finalizarPedidoActual: Avisa al servidor que la canción pagada ha terminado correctamente para moverla al historial de la base de datos.
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
  // cargarCola: Petición recurrente al Backend para obtener los pedidos de clientes pagados y actualizar la lista de reproducción local.
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
  // formatTime: Utilidad para convertir milisegundos en un formato de tiempo legible (minutos:segundos) para el reproductor.
  formatTime(ms: number): string {
    if (!ms) return "0:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  // search: Disparador manual para refrescar el valor del control de búsqueda en la interfaz de usuario.
  search() {
    const val = this.searchControl.value;
    if (val && val.trim().length > 0) this.searchControl.setValue(val);
  }
  // anadir: Prepara el objeto de pago con los metadatos de la canción seleccionada y abre el modal de la pasarela de Stripe.
  anadir(track: any) {
    if (this.precioCancion <= 0) {
        alert("El sistema de precios no está disponible.");
        return;
    }
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
  // onPaymentClosed: Gestiona el cierre del modal de pago. Si la transacción fue exitosa, limpia la búsqueda y refresca la cola inmediatamente.
  onPaymentClosed(success: boolean) {
    this.showPaymentModal = false;
    if (success) {
      this.searchControl.setValue('', { emitEvent: false });
      this.searchResults = [];
      this.cargarCola();
    }
  }
  // restaurarEstado: Al iniciar, verifica si había un 'PEDIDO' sonando antes de cerrar la sesión para intentar reanudarlo inmediatamente sin perder la posición.
  logout() {
    localStorage.clear();
    this.player?.disconnect();
    this.router.navigate(['/login']);
  }
  // ngOnDestroy: Limpia la memoria. Desconecta al reproductor y detiene todos los cronómetros y suscripciones para evitar fugas de recursos.
  ngOnDestroy() {
    if (this.player) this.player.disconnect();
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    if (this.progressTimer) clearInterval(this.progressTimer);
    if (this.deviceSubscription) this.deviceSubscription.unsubscribe();
    this.titleService.setTitle('Gramola'); 
  }
  // getDevices: Realiza una petición manual para listar los dispositivos disponibles (móvil, PC, etc.) y detecta cuál es el dispositivo activo actualmente.
  selectDevice(device: any) {
      this.deviceId = device.id;
      this.currentDevice = device;
      this.reproducirAmbiente(true);
      this.cdr.detectChanges();
  }
}