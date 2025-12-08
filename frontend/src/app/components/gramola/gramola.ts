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
  private cdr = inject(ChangeDetectorRef); // INYECCIÓN NECESARIA

  usuario: any = null;
  spotifyConnected: boolean = false;
  busqueda: string = '';
  searchResults: any[] = []; 
  colaReproduccion: any[] = [];
  
  player: any;
  deviceId: string = '';
  currentTrack: any = null;
  cancionSonando: any = null; // Guardamos la canción de nuestra BD
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

        // Lógica de fin de canción
        if (state.paused && state.position === 0 && this.wasPlaying) {
            if (!this.cambiandoCancion) {
                console.log("Canción terminada. Siguiente...");
                this.wasPlaying = false; 
                this.siguienteCancion();
            }
        }

        // ESTA LÍNEA ES LA CLAVE: Forzamos a Angular a repintar la vista
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

  search() {
    if (this.busqueda.length > 2) {
      this.spotifyService.searchTracks(this.busqueda, this.usuario.id).subscribe({
        next: (res: any) => {
          this.ngZone.run(() => {
            this.searchResults = res.tracks.items;
          });
        }
      });
    }
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

  reproducir(cancion: any) {
    if (!this.deviceId) return;

    this.spotifyService.playTrack(cancion.spotifyId, this.deviceId, this.usuario.id).subscribe({
      next: () => {
        console.log("Reproduciendo:", cancion.titulo);
        
        // Guardamos referencia para finalizarla correctamente después
        this.cancionSonando = cancion;

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

  siguienteCancion() {
    if (this.colaReproduccion.length === 0) return;
    
    if (this.cambiandoCancion) return;
    this.cambiandoCancion = true;

    // Finalizamos la que estaba sonando (si existe)
    if (this.cancionSonando) {
        this.gramolaService.actualizarEstado(Number(this.cancionSonando.id), 'TERMINADA').subscribe();
    }

    // Tomamos la primera de la cola
    const siguiente = this.colaReproduccion[0];
    
    // Actualizamos la UI localmente al instante para evitar rebotes visuales
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