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

    this.spotifyService.search(this.busqueda, this.usuario.id, 'playlist').subscribe({
      next: (res: any) => {
        this.ngZone.run(() => {
          this.resultados = res.playlists?.items || [];
          this.cargando = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        console.error('Error buscando playlists', err);
        this.ngZone.run(() => {
          this.cargando = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  seleccionar(playlist: any) {
    // 1. Guardamos la nueva playlist
    localStorage.setItem('playlistFondo', JSON.stringify(playlist));
    
    // 2. CRÍTICO: Borramos el rastro de la canción anterior para evitar conflictos
    // Así la Gramola sabe que debe empezar la nueva lista desde el principio.
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