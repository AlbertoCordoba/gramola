/*
 * ======================================================================================
 * COMPONENTE PRINCIPAL: GRAMOLA (Reproductor Inteligente)
 * ======================================================================================
 * Este componente es el cerebro de la aplicación.
 * Responsabilidades:
 * 1. Inicializar y controlar el SDK Web de Spotify (Hardware virtual).
 * 2. Gestionar la cola de reproducción híbrida (Pedidos de clientes + Música de fondo).
 * 3. Sincronizar el estado con el servidor (Polling) y la UI (RxJS).
 */

import { Component, inject, OnDestroy, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
// Importamos operadores de RxJS para optimizar la búsqueda en tiempo real
import { debounceTime, distinctUntilChanged, filter, switchMap, tap, finalize, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

import { SpotifyConnectService } from '../../services/spotify.service';
import { GramolaService } from '../../services/gramola.service';
import { PagoStateService } from '../../services/pago-state.service';
import { PasarelaPagoComponent } from '../pasarela-pago/pasarela-pago.component';

// Extendemos la interfaz Window para que TypeScript reconozca la librería externa de Spotify
declare global {
  interface Window { 
    onSpotifyWebPlaybackSDKReady: () => void; 
    Spotify: any; 
  }
}

// Interfaz para normalizar visualmente canciones que vienen de distintas fuentes (API vs BD)
interface ItemCola {
  titulo: string;
  artista: string;
  imagen?: string;
  tipo: 'PEDIDO' | 'AMBIENTE'; // Esta etiqueta permite pintar estilos diferentes en el HTML
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
  // --- INYECCIÓN DE DEPENDENCIAS (Angular 16+) ---
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private spotifyService = inject(SpotifyConnectService); // Proxy de comunicación con Spotify
  private gramolaService = inject(GramolaService);       // Gestión de la cola en base de datos
  private titleService = inject(Title);                  // Para cambiar el título de la pestaña (UX)
  private http = inject(HttpClient);
  // NgZone: Vital para el SDK de Spotify. Sus eventos ocurren "fuera" de Angular,
  // y necesitamos reintroducirlos en la zona para que la vista se actualice.
  private ngZone = inject(NgZone); 
  private cdr = inject(ChangeDetectorRef); // Permite forzar el renderizado manual
  private pagoState = inject(PagoStateService); // Comparte datos con el modal de pago

  // --- ESTADO DE SESIÓN Y CONFIGURACIÓN ---
  usuario: any = null;
  playlistFondo: any = null; // La playlist de "respaldo" que suena si no hay pedidos

  // --- BUSCADOR REACTIVO ---
  searchControl = new FormControl(''); // Input reactivo (Reactive Forms)
  isSearching: boolean = false;        // Controla el spinner de carga
  searchResults: any[] = [];
  
  // --- COLAS DE DATOS (MODELO) ---
  colaReproduccion: any[] = [];   // Pedidos reales pagados (Vienen del Backend Java)
  siguientesSpotify: any[] = [];  // Cola interna que Spotify tiene preparada (Contexto)
  tracksRespaldo: any[] = [];     // Copia local de la playlist ambiente para cálculos rápidos
  
  // --- COLAS VISUALES (VISTA) ---
  colaVisual: ItemCola[] = [];    // Lista fusionada que ve el usuario final
  historialVisual: any[] = [];    // Registro de las últimas canciones sonadas

  // --- CONTROL DEL REPRODUCTOR ---
  player: any;                    // Instancia del objeto Player de Spotify
  deviceId: string = '';          // ID del "altavoz virtual" del navegador
  currentTrack: any = null;       // Metadatos de la canción sonando ahora
  isPaused: boolean = true;
  
  // Máquina de estados: ¿Qué estamos tocando?
  modoReproduccion: 'AMBIENTE' | 'PEDIDO' = 'AMBIENTE';
  
  cancionSonando: any = null;     // Objeto del pedido actual (si estamos en modo PEDIDO)
  resumeTrackUri: string = '';    // "Bookmark" para saber dónde dejamos la música ambiente
  
  // --- SISTEMA DE PROGRESO ---
  progressMs: number = 0;
  durationMs: number = 0;
  progressPercent: number = 0;
  private progressTimer: any;     // Intervalo local para suavizar la barra de tiempo

  // --- CONTROL DE UI ---
  showPaymentModal: boolean = false;
  private pollingInterval: any;   // Intervalo para preguntar al servidor por nuevos pedidos
  
  // --- SEMÁFOROS Y CONTROL DE ESTADO ---
  private lastTrackId: string = ''; 
  private changingTrack: boolean = false; // Bloqueo crítico para evitar condiciones de carrera (Race Conditions)
  necesitaInteraccion: boolean = false;   // Detecta si el navegador bloqueó el Autoplay
  precioCancion: number = 0;

  private songStartTime: number = 0;     // Para evitar añadir canciones al historial si solo sonaron 1 seg
  private wasPedido: boolean = false;    

  constructor() {
    // 1. Recuperación de Sesión
    const userJson = localStorage.getItem('usuarioBar');
    if (userJson) {
      this.usuario = JSON.parse(userJson);
    } else {
      this.router.navigate(['/login']); // Redirección de seguridad
    }

    // 2. PERSISTENCIA DE ESTADO (Resilience Pattern)
    // Si el usuario recarga la página (F5), guardamos el estado exacto antes de morir.
    // Esto permite "resucitar" la reproducción donde se quedó.
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
    // 3. CARGA DE CONFIGURACIÓN
    const plGuardada = localStorage.getItem('playlistFondo');
    if (plGuardada) {
        this.playlistFondo = JSON.parse(plGuardada);
        // Cargamos los tracks de fondo en memoria para poder usarlos si la cola se vacía
        this.cargarTracksDeRespaldo(); 
    } else {
        // Si no hay configuración, obligamos a ir a seleccionarla
        this.router.navigate(['/config-audio']);
        return;
    }

    // 4. RESTAURACIÓN (Rehidratación del estado)
    const lastModo = localStorage.getItem('lastModo');
    if (lastModo === 'PEDIDO') {
        this.modoReproduccion = 'PEDIDO';
        this.changingTrack = true; // Bloqueamos cambios hasta que el reproductor esté listo
    }

    const savedAmbient = localStorage.getItem('ambientResumeUri');
    if (savedAmbient) {
        this.resumeTrackUri = savedAmbient;
    }

    if (this.usuario) {
      this.initSpotifySDK(); // Inyectamos el script del reproductor
      this.cargarCola();     // Petición inicial de datos al backend
      
      // CAMBIO 1: Cargar el precio
      this.cargarPrecioCancion();
      
      this.setupLiveSearch(); // Configuramos el pipeline de búsqueda reactiva

      // 5. POLLING (Sondeo periódico)
      // En lugar de WebSockets (que sería más complejo), hacemos peticiones cada 5s
      // para ver si han entrado pedidos nuevos. Es simple y robusto.
      this.pollingInterval = setInterval(() => {
        if (!this.changingTrack) { // No preguntamos si estamos cambiando de canción (estabilidad)
          this.cargarCola();
        }
      }, 5000);

      // 6. SIMULACIÓN DE PROGRESO (Timer Local)
      // Pedir el progreso a la API cada segundo satura la red.
      // Lo calculamos localmente y solo lo sincronizamos en eventos clave.
      this.progressTimer = setInterval(() => {
        if (!this.isPaused && this.currentTrack) {
          this.progressMs += 1000;
          if (this.progressMs > this.durationMs) this.progressMs = this.durationMs;
          if (this.durationMs > 0) {
              this.progressPercent = (this.progressMs / this.durationMs) * 100;
          }
          this.cdr.detectChanges(); // Forzamos actualización visual de la barra
        }
      }, 1000);
    }
  }

  // --- BÚSQUEDA REACTIVA (RxJS Pipeline) ---
  setupLiveSearch() {
    this.searchControl.valueChanges.pipe(
      // Filtros para optimizar rendimiento y UX
      filter(text => (text || '').trim().length > 0),
      debounceTime(300),      // Espera a que el usuario deje de escribir
      distinctUntilChanged(), // Evita buscar lo mismo dos veces
      tap(() => {
        this.ngZone.run(() => {
          this.isSearching = true; // Feedback visual inmediato (Spinner)
          this.cdr.detectChanges();
        });
      }),
      // SwitchMap cancela peticiones anteriores si llega una nueva (ahorro de ancho de banda)
      switchMap(text => {
        return this.spotifyService.search(text!, this.usuario.id, 'track').pipe(
          catchError(err => {
            console.error('Error en búsqueda Spotify:', err);
            return of(null); // Manejo de errores sin romper el flujo
          }),
          finalize(() => {})
        );
      })
    ).subscribe({
      next: (res: any) => {
        this.ngZone.run(() => {
          this.isSearching = false;
          // Procesamiento de resultados
          if (res && res.tracks) {
            this.searchResults = res.tracks.items || [];
          } else {
            this.searchResults = []; 
          }
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        console.error("Error crítico en buscador:", err);
        this.isSearching = false;
      }
    });
  }

  // Pre-carga los tracks de ambiente para calcular el algoritmo de mezcla después
  cargarTracksDeRespaldo() {
    if (!this.playlistFondo?.id) return;
    this.spotifyService.getPlaylist(this.playlistFondo.id, this.usuario.id).subscribe({
      next: (res: any) => {
        if (res.tracks && res.tracks.items) {
          // Aplanamos la estructura compleja de Spotify
          this.tracksRespaldo = res.tracks.items
            .map((item: any) => item.track)
            .filter((t: any) => t && t.id);
          this.actualizarColaVisual();
        }
      },
      error: (e) => console.error("Error cargando respaldo:", e)
    });
  }

  // Generador de clave única para identificar canciones (Título + Artista)
  // Útil para no mostrar duplicados en la lista visual.
  private getTrackKey(titulo: string, artista: string): string {
    return `${titulo?.toLowerCase().trim().replace(/[^a-z0-9]/g, '')}|${artista?.toLowerCase().trim().replace(/[^a-z0-9]/g, '')}`;
  }

  // --- ALGORITMO DE BÚSQUEDA INTELIGENTE ---
  // Busca una canción en la playlist de respaldo. Si no encuentra el ID (porque Spotify cambia IDs a veces),
  // busca por nombre y artista (Fuzzy Search).
  private encontrarIndiceSeguro(trackId: string, trackUri: string, trackName: string, trackArtist: string): number {
    if (!this.tracksRespaldo || this.tracksRespaldo.length === 0) return -1;
    
    // 1. Intento Exacto por ID
    let idx = this.tracksRespaldo.findIndex(t => t.id === trackId);
    if (idx !== -1) return idx;
    
    // 2. Intento Exacto por URI
    if (trackUri) {
        idx = this.tracksRespaldo.findIndex(t => t.uri === trackUri);
        if (idx !== -1) return idx;
    }
    
    // 3. Intento Aproximado (Fuzzy) por Metadatos
    const keyBuscada = this.getTrackKey(trackName, trackArtist);
    idx = this.tracksRespaldo.findIndex(t => 
        this.getTrackKey(t.name, t.artists[0]?.name) === keyBuscada
    );
    return idx;
  }

  // --- MOTOR DE VISUALIZACIÓN DE LA COLA ---
  // Este método decide qué ve el usuario: mezcla pedidos reales con música de relleno.
  actualizarColaVisual() {
    const listaFinal: ItemCola[] = [];
    const MINIMO_CANCIONES = 5; // Siempre mostramos al menos 5 siguientes
    const clavesAgregadas = new Set<string>();

    // 1. Identificar canción actual para no repetirla en la lista "Siguiente"
    let currentId = '';
    let currentKey = '';
    if (this.currentTrack) {
        currentId = this.currentTrack.linked_from?.id || this.currentTrack.id;
        const nombre = this.currentTrack.name;
        const artista = this.currentTrack.artists[0]?.name;
        currentKey = this.getTrackKey(nombre, artista);
        clavesAgregadas.add(currentKey); 
    }

    // 2. AÑADIR PEDIDOS (Prioridad Alta)
    this.colaReproduccion.forEach(p => {
      const key = this.getTrackKey(p.titulo, p.artista);
      if (p.spotifyId !== currentId && !clavesAgregadas.has(key)) {
          listaFinal.push({
            titulo: p.titulo,
            artista: p.artista,
            tipo: 'PEDIDO', // Etiqueta visual distinta
            id: p.spotifyId,
            imagen: p.imagenUrl 
          });
          clavesAgregadas.add(key);
      }
    });

    // 3. RELLENO INTELIGENTE (Fallback a Ambiente)
    // Si no hay suficientes pedidos, rellenamos con la playlist de fondo
    if (listaFinal.length < MINIMO_CANCIONES) {
        let candidatosAmbiente: any[] = [];
        
        // Opción A: Usar la cola nativa de Spotify si estamos en modo ambiente
        if (this.modoReproduccion === 'AMBIENTE' && this.siguientesSpotify.length > 0) {
            candidatosAmbiente = [...this.siguientesSpotify];
        } 
        
        // Opción B: Calcular manualmente desde nuestro respaldo local (Más robusto)
        if (candidatosAmbiente.length < MINIMO_CANCIONES && this.tracksRespaldo.length > 0) {
            let refId = '', refUri = '', refName = '', refArtist = '';
            let usarReferenciaGuardada = true;

            // Si está sonando ambiente, calculamos desde la canción actual
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

            // Si no, usamos la última referencia guardada (Bookmark)
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

            // Seleccionamos canciones circulares (si llegamos al final, volvemos al principio)
            let indice = this.encontrarIndiceSeguro(refId, refUri, refName, refArtist);
            if (indice === -1) indice = 0;
            let inicioOffset = (this.modoReproduccion === 'PEDIDO' || usarReferenciaGuardada) ? 0 : 1;

            for (let i = inicioOffset; i <= 20; i++) {
                const nextIndex = (indice + i) % this.tracksRespaldo.length;
                candidatosAmbiente.push(this.tracksRespaldo[nextIndex]);
            }
        }

        // Añadimos los candidatos calculados a la lista final
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
                tipo: 'AMBIENTE', // Etiqueta visual distinta
                id: track.id,
                imagen: track.album?.images[0]?.url || track.album?.images[1]?.url
            });
            clavesAgregadas.add(key);
        }
    }
    this.colaVisual = listaFinal;
    this.cdr.detectChanges();
  }

  // CAMBIO 2: Usamos HttpClient directo para asegurar que encontramos el endpoint
  cargarPrecioCancion() {
    this.http.get<any>('http://localhost:8080/api/bares/precios').subscribe({
      next: (precios: any) => {
        if (precios && precios['PRECIO_CANCION']) {
          this.precioCancion = precios['PRECIO_CANCION'];
          console.log('✅ Precio actualizado:', this.precioCancion);
        }
      },
      error: (e) => console.error('Error cargando precio', e)
    });
  }

  // --- GESTIÓN DEL REPRODUCTOR (SDK) ---
  initSpotifySDK() {
    if (window.Spotify) {
      this.requestTokenAndConnect();
      return;
    }
    // Carga asíncrona del script externo de Spotify
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
    // Pedimos un token fresco al Backend antes de conectar
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

    // EVENTO: Dispositivo listo
    this.player.addListener('ready', ({ device_id }: any) => {
      this.ngZone.run(() => {
        console.log('Player ID Ready:', device_id);
        this.deviceId = device_id;
        // Damos un segundo de margen para que la API registre el dispositivo antes de usarlo
        setTimeout(() => this.restaurarEstado(), 1000); 
      });
    });

    // EVENTO: Cambio de estado (Play, Pause, Next)
    this.player.addListener('player_state_changed', (state: any) => {
      this.ngZone.run(() => {
        this.gestionarCambioDeEstado(state);
      });
    });

    // Manejo de errores de conexión/autenticación
    this.player.addListener('initialization_error', ({ message }: any) => console.error(message));
    this.player.addListener('authentication_error', ({ message }: any) => console.error(message));
    this.player.addListener('account_error', ({ message }: any) => console.error(message));

    this.player.connect();
  }

  // --- LÓGICA DE CONTROL (EL CEREBRO) ---

  // Decide si continuar con un pedido pendiente o iniciar ambiente
  restaurarEstado() {
    const lastModo = localStorage.getItem('lastModo');
    const pedidoJson = localStorage.getItem('pedidoPendiente');

    if (lastModo === 'PEDIDO' && pedidoJson) {
        // Intento de recuperación de fallo (Crash Recovery)
        try {
            this.changingTrack = true;
            const pedidoGuardado = JSON.parse(pedidoJson);
            this.modoReproduccion = 'PEDIDO';
            this.cancionSonando = pedidoGuardado;
            
            // Reintentamos reproducir el pedido
            this.spotifyService.playTrack(pedidoGuardado.spotifyId, this.deviceId, this.usuario.id).subscribe({
                next: () => this.verificarAutoplay(),
                error: (err) => {
                    // Si falla el reintento, hacemos fallback a ambiente (Degradación grácil)
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
        // Arranque limpio en modo ambiente
        this.changingTrack = false;
        this.reproducirAmbiente(true); 
    }
  }

  // Gestión de políticas de navegador (Autoplay Policy)
  // Si el navegador bloquea el audio, detectamos el estado "paused" y pedimos interacción.
  verificarAutoplay() {
    setTimeout(() => {
        this.player.getCurrentState().then((state: any) => {
            if (!state || state.paused) {
                this.ngZone.run(() => {
                    this.necesitaInteraccion = true; // Muestra el overlay "Activar Sonido"
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

  // MÉTODO MAESTRO: Reacciona a cada evento del reproductor
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
    
    // Verificamos si estamos dentro de la playlist de fondo correcta
    const esMismaPlaylist = context && this.playlistFondo && context.uri && this.playlistFondo.uri &&
                            (context.uri === this.playlistFondo.uri || context.uri.includes(this.playlistFondo.id));

    // Si es ambiente, guardamos el "punto de lectura" para volver luego
    if (this.modoReproduccion === 'AMBIENTE' && !this.changingTrack && currentUri) {
         if (esMismaPlaylist) {
             this.resumeTrackUri = currentUri;
             localStorage.setItem('ambientResumeUri', currentUri);
         }
    }

    // --- DETECCIÓN DE FIN DE PEDIDO ---
    // Si cambió la canción y estábamos en modo PEDIDO...
    if (this.lastTrackId && trackId !== this.lastTrackId && this.modoReproduccion === 'PEDIDO' && !this.changingTrack) {
        // 1. Marcar pedido como terminado en BD
        this.finalizarPedidoActual(); 
        
        // 2. Decisión: ¿Más pedidos o ambiente?
        if (this.colaReproduccion.length > 0) {
             this.procesarSiguientePedido();
        } else {
             this.modoReproduccion = 'AMBIENTE';
             localStorage.removeItem('pedidoPendiente');
             this.reproducirAmbiente(); 
        }
    }

    // --- INTERRUPCIÓN DE AMBIENTE ---
    // Si llega un pedido mientras suena ambiente...
    if (this.modoReproduccion === 'AMBIENTE' && this.colaReproduccion.length > 0 && this.lastTrackId && trackId !== this.lastTrackId) {
        // Guardamos historial si sonó lo suficiente (>5s)
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

    // Actualización de historial general
    if (this.currentTrack && trackId !== this.lastTrackId && this.lastTrackId !== '') {
        if (Date.now() - this.songStartTime > 5000) {
            this.agregarAlHistorialVisual(this.currentTrack, this.wasPedido ? 'PEDIDO' : 'AMBIENTE');
        }
    }
    
    // Actualización de metadatos del SO (MediaSession API)
    if (trackId !== this.lastTrackId) {
        this.songStartTime = Date.now();
        this.wasPedido = (this.modoReproduccion === 'PEDIDO'); 
        this.gramolaService.actualizarMetadataMultimedia(track);
    }

    // Sincronización de estado local
    this.currentTrack = track;
    this.isPaused = state.paused;
    this.durationMs = state.duration;
    this.progressMs = state.position;
    this.progressPercent = (this.progressMs / this.durationMs) * 100;

    // Caso Borde: Spotify a veces pausa al final de la canción en lugar de cambiar
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

  // Lógica para poner música de fondo
  reproducirAmbiente(chequearAutoplay: boolean = false) {
    if (!this.deviceId || !this.playlistFondo) return;
    this.changingTrack = true;
    this.modoReproduccion = 'AMBIENTE';
    this.cancionSonando = null;
    localStorage.removeItem('pedidoPendiente');

    // Intentamos reanudar (offset) o empezar de cero
    let offset: string | undefined = undefined;
    if (this.resumeTrackUri) offset = this.resumeTrackUri;
    else if (localStorage.getItem('ambientResumeUri')) offset = localStorage.getItem('ambientResumeUri') || undefined;
    
    // Validación de formato URI
    if (offset && !offset.includes('spotify:track:')) offset = undefined;

    this.spotifyService.playContext(this.playlistFondo.uri, this.deviceId, this.usuario.id, offset).subscribe({
      next: () => {
        if (chequearAutoplay) this.verificarAutoplay();
        else this.resetVariables();
      },
      error: (err) => {
        // Fallback: Si el offset falla (ej: canción borrada de la lista), reproducimos sin offset
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

  // Handler para el botón manual de "Activar Sonido"
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
        this.changingTrack = false; // Liberamos semáforo
        this.songStartTime = Date.now(); 
        this.wasPedido = false;
        this.cdr.detectChanges(); 
    }, 1500);
  }

  // Lógica para poner el siguiente pedido
  procesarSiguientePedido() {
    if (this.colaReproduccion.length === 0) return;
    this.changingTrack = true;
    const siguiente = this.colaReproduccion[0]; // FIFO (First In First Out)
    this.modoReproduccion = 'PEDIDO';
    this.cancionSonando = siguiente;
    
    // Guardamos estado para recuperación ante fallos
    localStorage.setItem('pedidoPendiente', JSON.stringify(siguiente));
    localStorage.setItem('lastModo', 'PEDIDO');

    this.spotifyService.playTrack(siguiente.spotifyId, this.deviceId, this.usuario.id).subscribe({
      next: () => {
        // Notificamos al servidor que la canción ha empezado (Estado: SONANDO)
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
        // Si falla, no bloqueamos la cola, saltamos
        this.changingTrack = false; 
        this.reproducirAmbiente(); 
      }
    });
  }

  // Notificar al servidor que el pedido terminó
  finalizarPedidoActual() {
    if (this.cancionSonando?.id) {
      this.gramolaService.actualizarEstado(Number(this.cancionSonando.id), 'TERMINADA').subscribe({
        next: () => {
          this.cancionSonando = null;
          localStorage.removeItem('pedidoPendiente'); 
          this.cargarCola(); // Recargar cola limpia
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
            // Filtramos el que suena para no duplicarlo visualmente
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

  // --- INTERACCIÓN DE USUARIO (Búsqueda y Pagos) ---
  search() {
    const val = this.searchControl.value;
    if (val && val.trim().length > 0) {
        this.searchControl.setValue(val);
    }
  }

  // CAMBIO 3: Validación del precio y preparación del pago dinámico
  anadir(track: any) {
    // Seguridad: Si no tenemos precio, no dejamos comprar
    if (this.precioCancion <= 0) {
        alert("El sistema de precios no está disponible. Recarga la página.");
        return;
    }

    const previewUrl = track.preview_url || track.previewUrl || '';
    // Preparamos transacción
    this.pagoState.setPago({
      concepto: `Canción: ${track.name}`,
      precio: this.precioCancion, // PRECIO DINÁMICO DE BD
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
      // Limpiar UI y refrescar cola tras pago exitoso
      this.searchControl.setValue('', { emitEvent: false });
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
    // Limpieza de recursos (evitar fugas de memoria)
    if (this.player) this.player.disconnect();
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    if (this.progressTimer) clearInterval(this.progressTimer);
    this.titleService.setTitle('Gramola'); 
  }
}