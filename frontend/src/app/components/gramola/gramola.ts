import { Component, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SpotifyConnectService } from '../../services/spotify.service';
// Make sure the path below matches the actual location of gramola.service.ts
import { GramolaService } from '../../services/gramola.service';

@Component({
  selector: 'app-gramola',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gramola.html',
  styleUrl: './gramola.css'
})
export class Gramola {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private spotifyService = inject(SpotifyConnectService);
  private gramolaService = inject(GramolaService);

  usuario: any = null;
  spotifyConnected: boolean = false;
  busqueda: string = '';
  searchResults: any[] = [];
  colaReproduccion: any[] = []; // Lista para la cola

  constructor() {
    const userJson = localStorage.getItem('usuarioBar');
    if (userJson) {
      this.usuario = JSON.parse(userJson);
      this.cargarCola(); // Cargar la cola al entrar
    } else {
      this.router.navigate(['/login']);
      return;
    }

    this.route.queryParams.subscribe(params => {
      if (params['status'] === 'connected') {
        this.spotifyConnected = true;
        this.router.navigate([], { queryParams: { status: null }, replaceUrl: true });
      }
    });
  }

  connectSpotify() {
    this.spotifyService.getAuthUrl().subscribe({
      next: (res) => window.location.href = res.url,
      error: (err) => console.error(err)
    });
  }

  search() {
    if (this.busqueda.length > 2) {
      this.spotifyService.searchTracks(this.busqueda).subscribe({
        next: (res: any) => this.searchResults = res.tracks.items,
        error: (err) => console.error(err)
      });
    }
  }

  // Nueva función: Añadir a la cola
  anadir(track: any) {
    if(!confirm("¿Añadir '" + track.name + "' por 0.50€?")) return;

    this.gramolaService.anadirCancion(track, Number(this.usuario.id)).subscribe({
    next: () => {
        alert("¡Canción añadida y pagada!");
        this.busqueda = '';
        this.searchResults = [];
        this.cargarCola(); // Recargar la lista
    },
    error: (err) => alert("Error al añadir canción")
    });
  }

  cargarCola() {
    this.gramolaService.obtenerCola(this.usuario.id).subscribe({
      next: (res: any) => this.colaReproduccion = res
    });
  }

  logout() {
    localStorage.removeItem('usuarioBar');
    this.router.navigate(['/login']);
  }
}