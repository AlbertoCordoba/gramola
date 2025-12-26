import { Component, inject, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { SpotifyConnectService } from '../../services/spotify.service';

@Component({
  selector: 'app-seleccion-playlist',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './seleccion-playlist.component.html',
  styleUrls: ['./seleccion-playlist.component.css']
})
export class SeleccionPlaylistComponent implements OnInit {
  private spotifyService = inject(SpotifyConnectService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  usuario: any = null;
  spotifyConnected: boolean = false;
  
  busqueda: string = '';
  resultados: any[] = [];
  cargando: boolean = false;

  ngOnInit() {
    const userJson = localStorage.getItem('usuarioBar');
    if (userJson) {
      this.usuario = JSON.parse(userJson);
    } else {
      this.router.navigate(['/login']);
      return;
    }

    const params = this.route.snapshot.queryParams;
    if (params['status'] === 'success') {
      this.spotifyConnected = true;
      this.router.navigate([], { replaceUrl: true, queryParams: {} });
    } else {
      this.checkConexion();
    }
  }

  checkConexion() {
    this.spotifyService.getToken(this.usuario.id).subscribe({
      next: (res: any) => {
        if (res.access_token) {
          this.spotifyConnected = true;
        }
      },
      error: () => {
        this.spotifyConnected = false;
      }
    });
  }

  conectarSpotify() {
    this.spotifyService.getAuthUrl(this.usuario.id).subscribe({
      next: (res: any) => window.location.href = res.url
    });
  }

  buscar() {
    if (!this.busqueda || this.busqueda.trim().length === 0) return;
    
    this.cargando = true;
    this.resultados = [];

    // 1. DETECTAR SI ES UN ENLACE DE SPOTIFY
    if (this.busqueda.includes('spotify.com') || this.busqueda.includes('spotify.com/playlist')) {
      
      let playlistId = '';
      try {
        const partes = this.busqueda.split('playlist/');
        if (partes.length > 1) {
          playlistId = partes[1].split('?')[0];
        }
      } catch (e) {
        console.error("Error parseando URL", e);
      }

      if (playlistId) {
        this.spotifyService.getPlaylist(playlistId, this.usuario.id).subscribe({
          next: (res: any) => {
            this.ngZone.run(() => {
              // Filtro de seguridad: solo si tiene canciones
              if (res && res.tracks && res.tracks.total > 0) {
                this.resultados = [res];
              } else {
                console.warn("La playlist del enlace está vacía");
                this.resultados = [];
              }
              this.cargando = false;
              this.cdr.detectChanges();
            });
          },
          // AQUI ESTABA EL ERROR 2: Añadido ': any'
          error: (err: any) => {
            console.error('Error cargando playlist por link', err);
            this.ngZone.run(() => {
              this.cargando = false;
              this.cdr.detectChanges();
            });
          }
        });
      } else {
        this.cargando = false;
      }

    } else {
      // 2. BÚSQUEDA NORMAL POR NOMBRE
      this.spotifyService.search(this.busqueda, this.usuario.id, 'playlist').subscribe({
        next: (res: any) => {
          this.ngZone.run(() => {
            const items = res.playlists?.items || [];
            
            // Filtro mágico para evitar playlists vacías
            this.resultados = items.filter((p: any) => 
              p && p.tracks && p.tracks.total > 0 && p.uri
            );

            this.cargando = false;
            this.cdr.detectChanges();
          });
        },
        // AQUI TAMBIEN: Añadido ': any'
        error: (err: any) => {
          console.error('Error buscando playlists', err);
          this.ngZone.run(() => {
            this.cargando = false;
            this.cdr.detectChanges();
          });
        }
      });
    }
  }

  seleccionar(playlist: any) {
    localStorage.setItem('playlistFondo', JSON.stringify(playlist));
    localStorage.removeItem('lastTrackUri'); 
    this.router.navigate(['/gramola']);
  }

  logout() {
    localStorage.removeItem('usuarioBar');
    localStorage.removeItem('playlistFondo');
    localStorage.removeItem('lastTrackUri');
    this.router.navigate(['/login']);
  }
}