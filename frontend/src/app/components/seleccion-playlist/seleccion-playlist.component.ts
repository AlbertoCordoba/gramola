/*
 * ======================================================================================
 * RESUMEN
 * ======================================================================================
 * * ¿QUÉ ES?
 * Pantalla de configuración inicial. Gestiona la conexión con Spotify y la selección
 * de la música de fondo (ambiente) usando un buscador en tiempo real.
 *
 * * PUNTOS CLAVE TÉCNICOS:
 * 1. BÚSQUEDA REACTIVA (RxJS Pipeline):
 * En 'setupLiveSearch', no buscamos cada vez que el usuario pulsa una tecla.
 * Usamos operadores avanzados:
 * - debounceTime(300): Espera a que el usuario deje de escribir 300ms.
 * - distinctUntilChanged(): Evita buscar lo mismo dos veces seguidas.
 * - switchMap(): Si el usuario busca "Rock" y luego "Pop" rápido, CANCELA la
 * petición de "Rock" y solo procesa la de "Pop". Ahorra ancho de banda.
 *
 * 2. ZONA ANGULAR (NgZone):
 * Al trabajar con callbacks asíncronos complejos, a veces Angular "pierde" el hilo
 * de la detección de cambios. Usamos 'this.ngZone.run()' para asegurar que la
 * interfaz se actualice (muestre el spinner o resultados) inmediatamente.
 *
 * 3. GESTIÓN DE PARÁMETROS DE URL:
 * Detectamos si venimos de un callback del Backend (?status=success) para activar
 * la interfaz automáticamente sin que el usuario haga nada.
 * ======================================================================================
 */

import { Component, inject, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { SpotifyConnectService } from '../../services/spotify.service';
import { debounceTime, distinctUntilChanged, filter, switchMap, tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-seleccion-playlist',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './seleccion-playlist.component.html',
  styleUrls: ['./seleccion-playlist.component.css']
})
export class SeleccionPlaylistComponent implements OnInit {
  // Inyección de dependencias
  private spotifyService = inject(SpotifyConnectService);
  private router = inject(Router);
  private route = inject(ActivatedRoute); // Para leer ?params= de la URL
  private ngZone = inject(NgZone); // Para forzar ejecución dentro de Angular
  private cdr = inject(ChangeDetectorRef);

  usuario: any = null;
  spotifyConnected: boolean = false; // Controla qué vista se muestra (Botón conectar vs Buscador)
  
  // FormControl: Permite suscribirse a los cambios de valor del input (valueChanges)
  searchControl = new FormControl('');
  
  resultados: any[] = [];
  cargando: boolean = false; // Muestra/oculta el spinner

  ngOnInit() {
    // 1. Verificación de Seguridad
    const userJson = localStorage.getItem('usuarioBar');
    if (userJson) {
      this.usuario = JSON.parse(userJson);
    } else {
      this.router.navigate(['/login']); // Si no hay usuario, fuera.
      return;
    }

    // 2. Detección de Retorno de OAuth (Backend Callback)
    // El Backend nos redirige a: /config-audio?status=success
    const params = this.route.snapshot.queryParams;
    if (params['status'] === 'success') {
      this.spotifyConnected = true;
      // Limpiamos la URL para que quede bonita (quita el ?status=success)
      this.router.navigate([], { replaceUrl: true, queryParams: {} });
    } else {
      // Si no venimos de un login reciente, comprobamos con el servidor si ya tenemos token válido
      this.checkConexion();
    }

    // 3. Inicializar el motor de búsqueda reactivo
    this.setupLiveSearch();
  }

  // Consulta al backend si el token de Spotify guardado en BD es válido
  checkConexion() {
    this.spotifyService.getToken(this.usuario.id).subscribe({
      next: (res: any) => {
        if (res.access_token) {
          this.spotifyConnected = true;
        }
      },
      error: () => {
        this.spotifyConnected = false; // Muestra el botón "Conectar con Spotify"
      }
    });
  }

  // Inicia el flujo OAuth redirigiendo al backend
  conectarSpotify() {
    this.spotifyService.getAuthUrl(this.usuario.id).subscribe({
      // window.location.href saca al usuario de nuestra app hacia la web de Spotify
      next: (res: any) => window.location.href = res.url
    });
  }

  // --- TUBERÍA REACTIVA (RXJS PIPELINE) ---
  // Este es el corazón técnico del componente.
  setupLiveSearch() {
    this.searchControl.valueChanges.pipe(
      // 1. Filtrado: No buscamos si el campo está vacío o solo tiene espacios
      filter(text => (text || '').trim().length > 0),
      
      // 2. Debounce: Esperamos 300ms de inactividad para no saturar la API
      debounceTime(300),
      
      // 3. Distinción: Si escribe "Rock", borra y vuelve a escribir "Rock", no buscamos de nuevo
      distinctUntilChanged(),
      
      // 4. Efecto Secundario (Tap): Activamos el spinner de carga antes de la petición
      tap(() => {
        this.ngZone.run(() => {
          this.cargando = true;
          this.resultados = [];
          this.cdr.detectChanges();
        });
      }),
      
      // 5. SwitchMap (Cancelación de peticiones):
      // Si llega una nueva búsqueda mientras la anterior sigue pendiente, CANCELA la anterior.
      // Garantiza que siempre mostremos los resultados de lo ÚLTIMO que escribió el usuario.
      switchMap(term => {
        const busqueda = term!;
        
        // DETECCIÓN INTELIGENTE DE URL
        // Si el usuario pega un link de Spotify en vez de texto, extraemos el ID y buscamos directo.
        if (busqueda.includes('spotify.com') || busqueda.includes('spotify.com/playlist')) {
          let playlistId = '';
          try {
            const partes = busqueda.split('playlist/');
            if (partes.length > 1) {
              playlistId = partes[1].split('?')[0]; // Limpiamos parámetros extra de la URL
            }
          } catch (e) { console.error("Error URL", e); }

          if (playlistId) {
            // Llamada directa por ID
            return this.spotifyService.getPlaylist(playlistId, this.usuario.id).pipe(
              catchError(() => of(null)) // Manejo de errores silencioso en el stream
            );
          }
          return of(null);
        } 
        
        // Búsqueda de texto normal
        else {
          return this.spotifyService.search(busqueda, this.usuario.id, 'playlist').pipe(
            catchError(() => of(null))
          );
        }
      })
    ).subscribe({
      // 6. Suscripción final: Recibimos los datos y actualizamos la vista
      next: (res: any) => {
        this.ngZone.run(() => {
          this.cargando = false;
          this.procesarResultados(res);
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        console.error("Error en live search", err);
        this.cargando = false;
      }
    });
  }

  // Normaliza la respuesta de Spotify (que es compleja) a una lista simple
  procesarResultados(res: any) {
    if (!res) {
      this.resultados = [];
      return;
    }

    // CASO A: Es una playlist individual (por URL directa)
    if (res.id && res.tracks && !res.playlists) {
      if (res.tracks.total > 0) {
        this.resultados = [res];
      } else {
        this.resultados = [];
      }
    }
    // CASO B: Es una lista de resultados de búsqueda
    else if (res.playlists && res.playlists.items) {
      const items = res.playlists.items || [];
      // Filtramos playlists vacías o rotas para no ensuciar la lista
      this.resultados = items.filter((p: any) => 
        p && p.tracks && p.tracks.total > 0 && p.uri
      );
    }
    else {
      this.resultados = [];
    }
  }

  // Método auxiliar para el botón manual de "Buscar"
  buscar() {
    const val = this.searchControl.value;
    if (val && val.trim().length > 0) {
      // Al setear el valor, disparará el valueChanges del pipeline de arriba
      this.searchControl.setValue(val);
    }
  }

  // Guardar selección y pasar a la Gramola
  seleccionar(playlist: any) {
    localStorage.setItem('playlistFondo', JSON.stringify(playlist));
    localStorage.removeItem('lastTrackUri'); // Limpiamos estado anterior
    this.router.navigate(['/gramola']);
  }

  logout() {
    localStorage.removeItem('usuarioBar');
    localStorage.removeItem('playlistFondo');
    localStorage.removeItem('lastTrackUri');
    this.router.navigate(['/login']);
  }
}