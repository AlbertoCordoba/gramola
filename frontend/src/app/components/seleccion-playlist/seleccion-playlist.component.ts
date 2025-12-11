import { Component, inject, OnInit } from '@angular/core';
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

  usuario: any = null;
  spotifyConnected: boolean = false;
  
  busqueda: string = '';
  resultados: any[] = [];

  ngOnInit() {
    // 1. Cargar usuario
    const userJson = localStorage.getItem('usuarioBar');
    if (userJson) {
      this.usuario = JSON.parse(userJson);
    } else {
      this.router.navigate(['/login']);
      return;
    }

    // 2. LÓGICA ROBUSTA (Sin parpadeos)
    // Miramos la URL una sola vez al entrar
    const params = this.route.snapshot.queryParams;

    if (params['status'] === 'success') {
      console.log("¡Conexión exitosa detectada!");
      this.spotifyConnected = true;
      
      // Limpiamos la URL silenciosamente
      this.router.navigate([], { 
        replaceUrl: true, 
        queryParams: {} 
      });
    } else {
      // Si NO venimos de conectar, entonces sí preguntamos al backend
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
        console.warn('No hay token válido, se requiere conexión.');
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
    if (!this.busqueda) return;
    this.spotifyService.search(this.busqueda, this.usuario.id, 'playlist').subscribe({
      next: (res: any) => {
        this.resultados = res.playlists?.items || [];
      },
      error: (err) => console.error('Error buscando playlists', err)
    });
  }

  seleccionar(playlist: any) {
    localStorage.setItem('playlistFondo', JSON.stringify(playlist));
    this.router.navigate(['/gramola']);
  }

  logout() {
    localStorage.removeItem('usuarioBar');
    localStorage.removeItem('playlistFondo');
    this.router.navigate(['/login']);
  }
}