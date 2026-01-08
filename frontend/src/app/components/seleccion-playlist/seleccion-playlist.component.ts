import { Component, inject, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // Necesario para [(ngModel)]
import { Router, ActivatedRoute } from '@angular/router';
import { SpotifyConnectService } from '../../services/spotify.service';
import { debounceTime, distinctUntilChanged, switchMap, catchError, filter } from 'rxjs/operators';
import { Subject, of } from 'rxjs';

@Component({
  selector: 'app-seleccion-playlist',
  standalone: true,
  imports: [CommonModule, FormsModule], // Importamos FormsModule
  templateUrl: './seleccion-playlist.component.html',
  styleUrls: ['./seleccion-playlist.component.css']
})
export class SeleccionPlaylistComponent implements OnInit {
  private spotifyService = inject(SpotifyConnectService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private ngZone = inject(NgZone);
  
  usuario: any = null;
  statusMessage: string = '';
  playlistSeleccionada: any = null;
  
  // VARIABLES QUE USA EL HTML
  busqueda: string = '';           // Coincide con [(ngModel)]="busqueda"
  resultados: any[] = [];
  cargando: boolean = false;
  necesitaConexion: boolean = false; // Coincide con *ngIf="necesitaConexion"

  private searchSubject = new Subject<string>();

  ngOnInit() {
    // 1. Cargar Usuario
    const userJson = localStorage.getItem('usuarioBar');
    if (userJson) {
      this.usuario = JSON.parse(userJson);
    } else {
      this.router.navigate(['/login']);
      return;
    }

    // 2. Gestionar vuelta de Spotify
    this.route.queryParams.subscribe(params => {
      if (params['status'] === 'success') {
        this.statusMessage = '✅ Conexión exitosa. ¡Busca una playlist!';
        this.necesitaConexion = false;
        this.router.navigate([], { replaceUrl: true, queryParams: {} });
      } else if (params['status'] === 'error') {
        this.statusMessage = '❌ Error conectando con Spotify.';
        this.necesitaConexion = true;
      } else {
        this.checkConexion();
      }
    });

    // 3. Configurar Buscador
    this.searchSubject.pipe(
      filter(term => term.trim().length > 0),
      debounceTime(500),
      distinctUntilChanged(),
      switchMap((term) => {
        this.ngZone.run(() => { this.cargando = true; });
        return this.spotifyService.search(term, this.usuario.id, 'playlist').pipe(
           catchError((err) => {
             // Si falla la autenticación (401), mostramos botón de conectar
             if (err.status === 400 || err.status === 401 || err.status === 500) {
                this.necesitaConexion = true;
                this.statusMessage = "⚠️ Tu sesión de Spotify ha caducado.";
             }
             return of([]);
           }) 
        );
      })
    ).subscribe({
      next: (res: any) => {
        this.ngZone.run(() => {
          this.cargando = false;
          if (res && res.playlists && res.playlists.items) {
             // Filtramos playlists rotas o vacías
             this.resultados = res.playlists.items
                .filter((p: any) => p && p.id && p.name && p.tracks && p.tracks.total > 0)
                .map((item: any) => ({ ...item, imgLoaded: false }));
          } else {
             this.resultados = [];
          }
        });
      },
      error: () => this.ngZone.run(() => { this.cargando = false; })
    });
  }

  // Verifica si tenemos token válido sin hacer ruido
  checkConexion() {
    this.spotifyService.getToken(this.usuario.id).subscribe({
      next: () => this.necesitaConexion = false,
      error: () => this.necesitaConexion = true
    });
  }

  // Método llamado por el HTML (keyup)
  onSearch() {
    if (this.busqueda.trim().length > 0) {
      this.searchSubject.next(this.busqueda);
    }
  }

  // Método llamado por el botón de conectar
  conectarSpotify() {
    this.spotifyService.getAuthUrl(this.usuario.id).subscribe({
      next: (res: any) => {
        if (res && res.url) {
            window.location.href = res.url; 
        } else {
            alert("Error: URL de conexión inválida.");
        }
      },
      error: () => alert("Error al conectar con el servidor.")
    });
  }

  seleccionar(playlist: any) {
    this.playlistSeleccionada = playlist;
    localStorage.setItem('playlistFondo', JSON.stringify({
      id: playlist.id,
      name: playlist.name,
      uri: playlist.uri,
      image: playlist.images?.[0]?.url
    }));
    // Limpiamos memoria para evitar conflictos
    localStorage.removeItem('ambientResumeUri'); 
    localStorage.removeItem('lastTrackUri');
    localStorage.removeItem('pedidoPendiente');
  }

  confirmar() {
    if (this.playlistSeleccionada) {
      this.router.navigate(['/gramola']);
    }
  }
}