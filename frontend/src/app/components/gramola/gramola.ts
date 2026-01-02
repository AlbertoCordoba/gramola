import { Component, inject, OnDestroy, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
// IMPORTANTE: Añadimos catchError y of para que no se rompa si hay error
import { debounceTime, distinctUntilChanged, filter, switchMap, tap, finalize, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

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
      
      // INICIALIZAR BÚSQUEDA EN VIVO
      this.setupLiveSearch();

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

  // --- BÚSQUEDA EN VIVO (CORREGIDA Y ROBUSTA) ---
  setupLiveSearch() {
    this.searchControl.valueChanges.pipe(
      // 1. IMPORTANTE: Debes escribir al menos 3 letras
      filter(text => (text || '').trim().length > 2),
      
      debounceTime(500),
      distinctUntilChanged(),
      
      tap(() => {
        this.ngZone.run(() => {
          this.isSearching = true;
          this.cdr.detectChanges();
        });
      }),
      
      switchMap(text => {
        return this.spotifyService.search(text!, this.usuario.id, 'track').pipe(
          // Si falla la API, capturamos el error DENTRO del switchMap
          // para que el listener principal NO SE ROMPA.
          catchError(err => {
            console.error('Error en búsqueda Spotify:', err);
            return of(null); // Devolvemos observable vacío para seguir vivos
          }),
          finalize(() => { 
             // Finalize se ejecuta siempre tras éxito o error del switchMap
          })
        );
      })
    ).subscribe({
      next: (res: any) => {
        this.ngZone.run(() => {
          this.isSearching = false;
          if (res && res.tracks) {
            this.searchResults = res.tracks.items || [];
          } else {
            this.searchResults = []; // Si hubo error (res=null) limpiamos
          }
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        // Este error solo salta si falla algo crítico en el pipe principal
        console.error("Error crítico en buscador:", err);
        this.isSearching = false;
      }
    });
  }

  // --- RESTO DE MÉTODOS IGUAL QUE ANTES ---

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

  private getTrackKey(titulo: string, artista: string): string {
    return `${titulo?.toLowerCase().trim().replace(/[^a-z0-9]/g, '')}|${artista?.toLowerCase().trim().replace(/[^a-z0-9]/g, '')}`;
  }

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
    
    const esMismaPlaylist = context && this.playlistFondo && context.uri && this.playlistFondo.uri &&
                            (context.uri === this.playlistFondo.uri || context.uri.includes(this.playlistFondo.id));

    if (this.modoReproduccion === 'AMBIENTE' && !this.changingTrack && currentUri) {
         if (esMismaPlaylist) {
             this.resumeTrackUri = currentUri;
             localStorage.setItem('ambientResumeUri', currentUri);
         }
    }

    if (this.lastTrackId && trackId !== this.lastTrackId && this.modoReproduccion === 'PEDIDO' && !this.changingTrack) {
        this.finalizarPedidoActual(); 
        if (this.colaReproduccion.length > 0) {
             this.procesarSiguientePedido();
        } else {
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
    this.actualizarColaVisual();
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

  // --- BÚSQUEDA MANUAL (Por si alguien da Enter) ---
  search() {
    const val = this.searchControl.value;
    if (val && val.trim().length > 2) {
        this.searchControl.setValue(val); // Dispara el listener del control
    }
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
      this.searchControl.setValue('', { emitEvent: false }); // Limpiamos sin disparar búsqueda
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