import { Component, inject, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SpotifyConnectService } from '../../services/spotify.service';
import { GramolaService } from '../../services/gramola.service';

@Component({
  selector: 'app-gramola',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gramola.html',
  styleUrl: './gramola.css'
})
export class Gramola implements OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private spotifyService = inject(SpotifyConnectService);
  private gramolaService = inject(GramolaService);

  usuario: any = null;
  spotifyConnected: boolean = false;
  busqueda: string = '';
  searchResults: any[] = []; // Array donde se guardan los resultados
  colaReproduccion: any[] = [];
  
  // Variables del Reproductor
  cancionActual: any = null;
  audioPlayer = new Audio(); // Reproductor nativo de HTML
  progreso: number = 0;

  constructor() {
    const userJson = localStorage.getItem('usuarioBar');
    if (userJson) {
      this.usuario = JSON.parse(userJson);
      this.cargarCola();
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

    // CRÍTICO 1: Cuando el audio termina, llama a la siguienteCancion()
    this.audioPlayer.onended = () => this.siguienteCancion();
    
    // CRÍTICO 2: Actualiza la barra de progreso usando el tiempo real del audio
    this.audioPlayer.ontimeupdate = () => {
      if (this.audioPlayer.duration) {
        this.progreso = (this.audioPlayer.currentTime / this.audioPlayer.duration) * 100;
      }
    };
  }
  
  // --- FUNCIONES DE INTERFAZ Y CONEXIÓN ---

  connectSpotify() {
    this.spotifyService.getAuthUrl().subscribe({
      next: (res) => window.location.href = res.url,
      error: (err) => console.error(err)
    });
  }

  search() {
    // La búsqueda solo se realiza con más de 2 caracteres
    if (this.busqueda.length > 2) {
      this.spotifyService.searchTracks(this.busqueda).subscribe({
        next: (res: any) => {
          console.log('Respuesta completa de Spotify (FRONTEND):', res);

          // Asignamos TODOS los resultados (sin filtro de preview_url)
          this.searchResults = res.tracks.items;

          console.log(`Canciones asignadas y listas para mostrar: ${this.searchResults.length}`);
        },
        error: (err) => {
          console.error('Error en búsqueda de Spotify (FRONTEND):', err);
        }
      });
    } else {
       console.log('Escribe al menos 3 caracteres para buscar.');
    }
  }

  // Corregido: Conversión segura del ID
  anadir(track: any) {
    if(!confirm(`¿Pagar 0.50€ por "${track.name}"?`)) return;

    // SOLUCIÓN AL ERROR: Convertimos el ID a NUMBER para el servicio
    console.log('Track seleccionado:', track);
    const barIdNumerico = Number(this.usuario.id); 

    this.gramolaService.anadirCancion(track, barIdNumerico).subscribe({
      next: () => {
        alert("¡Canción añadida y pagada!");
        this.busqueda = '';
        this.searchResults = [];
        this.cargarCola(); // Recargar la lista, lo que activará la reproducción si es necesario
      },
      error: (err) => {
        console.error(err);
        alert("Error al añadir canción");
      }
    });
  }

  // --- GESTIÓN DE COLA Y REPRODUCCIÓN ---

  cargarCola() {
    const barIdNumerico = Number(this.usuario.id); 

    this.gramolaService.obtenerCola(barIdNumerico).subscribe({
      next: (res: any) => {
        this.colaReproduccion = res;
        // Si no hay nada sonando, intenta reproducir la primera de la cola
        if (!this.cancionActual && this.colaReproduccion.length > 0) {
          this.reproducir(this.colaReproduccion[0]);
        }
      },
      error: (err) => console.error("Error cargando cola", err)
    });
  }

  reproducir(cancion: any) {
    this.cancionActual = cancion;
    this.progreso = 0; // Resetear barra

    // Avisar al backend que está SONANDO (Usamos Number() para la ID)
    this.gramolaService.actualizarEstado(Number(cancion.id), 'SONANDO').subscribe();

    if (cancion.previewUrl) {
      this.audioPlayer.src = cancion.previewUrl;
      this.audioPlayer.load();
      
      // Intentar reproducir
      this.audioPlayer.play().catch(e => {
         console.warn("Fallo al intentar reproducir el audio:", e);
      });
    } else {
      // Si la canción no tiene preview, pasamos a la siguiente rápidamente
      console.warn("Canción sin URL de audio. Saltando tras 2s.");
      setTimeout(() => this.siguienteCancion(), 2000); 
    }
  }
  
  siguienteCancion() {
    this.audioPlayer.pause();
    
    if (!this.cancionActual) return;

    // Marcar como TERMINADA
    // Es CRÍTICO que el ID sea NUMÉRICO para el Backend
    this.gramolaService.actualizarEstado(Number(this.cancionActual.id), 'TERMINADA').subscribe(() => {
      this.cancionActual = null;
      this.progreso = 0;
      this.cargarCola(); // Recargar cola para que la siguiente empiece
    });
  }

  logout() {
    localStorage.removeItem('usuarioBar');
    this.audioPlayer.pause();
    this.router.navigate(['/login']);
  }

  ngOnDestroy() {
    this.audioPlayer.pause();
  }
}