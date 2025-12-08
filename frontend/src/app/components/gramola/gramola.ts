import { Component, inject, OnDestroy, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { SpotifyConnectService } from '../../services/spotify.service';
import { GramolaService } from '../../services/gramola.service';

declare global {
  interface Window { 
    onSpotifyWebPlaybackSDKReady: () => void; 
    Spotify: any; 
  }
}

@Component({
  selector: 'app-gramola',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gramola.html',
  styleUrl: './gramola.css'
})
export class Gramola implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private spotifyService = inject(SpotifyConnectService);
  private gramolaService = inject(GramolaService);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef); // Inyección para forzar refresco de vista

  usuario: any = null;
  spotifyConnected: boolean = false;
  
  // Variables de Búsqueda
  busqueda: string = '';
  isSearching: boolean = false; // Nueva variable para controlar el estado del botón
  searchResults: any[] = []; 
  
  // Variables de Cola y Reproducción
  colaReproduccion: any[] = [];
  player: any;
  deviceId: string = '';
  
  currentTrack: any = null;    // Info que viene del SDK de Spotify
  cancionSonando: any = null;  // Info de nuestra BD (para tener el ID y marcarla terminada)
  isPaused: boolean = false;
  
  private pollingInterval: any;
  private cambiandoCancion: boolean = false;
  private wasPlaying: boolean = false; 

  constructor() {
    const userJson = localStorage.getItem('usuarioBar');
    if (userJson) {
      this.usuario = JSON.parse(userJson);
    } else {
      this.router.navigate(['/login']);
    }
  }

  ngOnInit() {
    this.route.queryParams.subscribe((params: any) => {
      if (params['status'] === 'success') {
        this.spotifyConnected = true;
        this.router.navigate([], { queryParams: {}, replaceUrl: true });
      }
    });

    if (this.usuario) {
      this.initSpotifySDK();
      this.cargarCola();

      this.pollingInterval = setInterval(() => {
        if (!this.cambiandoCancion) {
          this.refrescarColaSilenciosamente();
        }
      }, 3000);
    }
  }

  initSpotifySDK() {
    if (window.Spotify) {
      this.requestTokenAndConnect();
      return;
    }

    window.onSpotifyWebPlaybackSDKReady = () => {
      this.requestTokenAndConnect();
    };

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
          this.spotifyConnected = true;
        }
      },
      error: (err: any) => console.warn('Error obteniendo token:', err)
    });
  }

  initializePlayer(token: string) {
    this.player = new window.Spotify.Player({
      name: 'Gramola Virtual Player',
      getOAuthToken: (cb: (token: string) => void) => { cb(token); },
      volume: 0.5
    });

    this.player.addListener('ready', ({ device_id }: any) => {
      this.ngZone.run(() => {
        console.log('Player Listo ID:', device_id);
        this.deviceId = device_id;
        if (this.colaReproduccion.length > 0 && !this.currentTrack) {
          this.reproducir(this.colaReproduccion[0]);
        }
      });
    });

    this.player.addListener('player_state_changed', (state: any) => {
      this.ngZone.run(() => {
        if (!state) return;
        
        this.currentTrack = state.track_window.current_track;
        this.isPaused = state.paused;
        
        if (!state.paused) {
            this.wasPlaying = true;
        }

        // Lógica de fin de canción: Se pausa, vuelve a 0 y estaba sonando
        if (state.paused && state.position === 0 && this.wasPlaying) {
            if (!this.cambiandoCancion) {
                console.log("Canción terminada. Siguiente...");
                this.wasPlaying = false; 
                this.siguienteCancion();
            }
        }

        // IMPORTANTE: Forzamos a Angular a actualizar la vista inmediatamente
        this.cdr.detectChanges();
      });
    });

    this.player.connect();
  }

  connectSpotify() {
    this.spotifyService.getAuthUrl(this.usuario.id).subscribe({
      next: (res: any) => window.location.href = res.url,
      error: (err: any) => console.error(err)
    });
  }

  // --- FUNCIÓN DE BÚSQUEDA MEJORADA ---
  search() {
    // 1. Validación simple
    if (!this.busqueda || this.busqueda.trim().length <= 2) {
      console.warn("Escribe al menos 3 letras para buscar.");
      return;
    }

    // 2. Feedback visual inmediato
    this.isSearching = true; 
    this.searchResults = []; // Limpiamos resultados anteriores

    this.spotifyService.searchTracks(this.busqueda, this.usuario.id).subscribe({
      next: (res: any) => {
        this.ngZone.run(() => {
          this.searchResults = res.tracks.items;
          this.isSearching = false;
          // Forzamos actualización para mostrar resultados ya
          this.cdr.detectChanges(); 
        });
      },
      error: (err: any) => {
        console.error('Error en búsqueda:', err);
        this.isSearching = false;
        this.cdr.detectChanges();
      }
    });
  }

  anadir(track: any) {
    this.gramolaService.anadirCancion(track, Number(this.usuario.id)).subscribe({
      next: () => {
        this.busqueda = '';
        this.searchResults = [];
        this.cargarCola(); 
      },
      error: (err: any) => console.error(err)
    });
  }

  cargarCola() {
    this.gramolaService.obtenerCola(Number(this.usuario.id)).subscribe({
      next: (res: any) => {
        this.ngZone.run(() => {
          this.colaReproduccion = res;
          // Si hay cola, tenemos dispositivo y NO está sonando nada, arrancar.
          if (this.deviceId && this.colaReproduccion.length > 0 && !this.currentTrack && !this.cambiandoCancion) {
            this.reproducir(this.colaReproduccion[0]);
          }
        });
      }
    });
  }

  refrescarColaSilenciosamente() {
    this.gramolaService.obtenerCola(Number(this.usuario.id)).subscribe({
      next: (res: any) => {
        this.ngZone.run(() => {
          this.colaReproduccion = res;
        });
      }
    });
  }

  // --- FUNCIÓN DE REPRODUCCIÓN CORREGIDA ---
  reproducir(cancion: any) {
    if (!this.deviceId) return;

    this.spotifyService.playTrack(cancion.spotifyId, this.deviceId, this.usuario.id).subscribe({
      next: () => {
        console.log("Reproduciendo:", cancion.titulo);
        
        // 1. Guardamos la canción que va a sonar (para poder finalizarla después)
        this.cancionSonando = cancion;

        // 2. Avisamos al backend
        this.gramolaService.actualizarEstado(Number(cancion.id), 'SONANDO').subscribe();
        
        this.cambiandoCancion = false;
        this.wasPlaying = false; 
      },
      error: (err: any) => {
        console.error("Error reproduciendo", err);
        this.cambiandoCancion = false;
      }
    });
  }

  // --- FUNCIÓN SIGUIENTE CANCIÓN CORREGIDA ---
  siguienteCancion() {
    if (this.colaReproduccion.length === 0) return;
    
    if (this.cambiandoCancion) return;
    this.cambiandoCancion = true;

    // Finalizamos LA QUE ESTABA SONANDO, no la primera de la cola
    if (this.cancionSonando) {
        this.gramolaService.actualizarEstado(Number(this.cancionSonando.id), 'TERMINADA').subscribe();
    }

    // Tomamos la SIGUIENTE de la cola
    const siguiente = this.colaReproduccion[0];
    
    // Quitamos la siguiente de la lista visual localmente para evitar parpadeos
    this.colaReproduccion.shift(); 

    this.reproducir(siguiente);
  }

  logout() {
    localStorage.removeItem('usuarioBar');
    if (this.player) this.player.disconnect();
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    this.router.navigate(['/login']);
  }

  ngOnDestroy() {
    if (this.player) this.player.disconnect();
    if (this.pollingInterval) clearInterval(this.pollingInterval);
  }
}