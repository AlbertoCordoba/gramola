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
  // Inyecciones de servicios
  private spotifyService = inject(SpotifyConnectService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  
  // Servicios para forzar la actualización de la vista
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  usuario: any = null;
  spotifyConnected: boolean = false;
  
  busqueda: string = '';
  resultados: any[] = [];
  cargando: boolean = false; // Nuevo: para mostrar feedback visual si quieres

  ngOnInit() {
    // 1. Cargar usuario del almacenamiento local
    const userJson = localStorage.getItem('usuarioBar');
    if (userJson) {
      this.usuario = JSON.parse(userJson);
    } else {
      this.router.navigate(['/login']);
      return;
    }

    // 2. Verificar si volvemos de la autenticación de Spotify
    const params = this.route.snapshot.queryParams;
    if (params['status'] === 'success') {
      console.log("¡Conexión exitosa detectada!");
      this.spotifyConnected = true;
      // Limpiamos la URL para que quede limpia
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

  // --- SOLUCIÓN AL PROBLEMA DEL BUSCADOR ---
  buscar() {
    if (!this.busqueda || this.busqueda.trim().length === 0) return;
    
    this.cargando = true;
    this.resultados = []; // Limpiamos la lista visualmente para que se note la nueva búsqueda

    this.spotifyService.search(this.busqueda, this.usuario.id, 'playlist').subscribe({
      next: (res: any) => {
        // NgZone.run asegura que Angular sepa que esto ha ocurrido dentro de su "zona"
        this.ngZone.run(() => {
          console.log("Resultados recibidos del backend:", res); // Debug
          
          this.resultados = res.playlists?.items || [];
          this.cargando = false;
          
          // detectChanges() fuerza a Angular a repintar el HTML inmediatamente
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
    localStorage.setItem('playlistFondo', JSON.stringify(playlist));
    this.router.navigate(['/gramola']);
  }

  logout() {
    localStorage.removeItem('usuarioBar');
    localStorage.removeItem('playlistFondo');
    this.router.navigate(['/login']);
  }
}