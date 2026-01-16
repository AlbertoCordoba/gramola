import { Component, inject, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; 
import { Router, ActivatedRoute } from '@angular/router';
import { SpotifyConnectService } from '../../services/spotify.service';
import { debounceTime, distinctUntilChanged, switchMap, catchError, filter, finalize, tap } from 'rxjs/operators';
import { Subject, of, merge } from 'rxjs'; 

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
  private cdr = inject(ChangeDetectorRef); // INYECCIÓN PARA FORZAR ACTUALIZACIÓN
  
  usuario: any = null;
  statusMessage: string = '';
  playlistSeleccionada: any = null;
  
  // VARIABLES HTML
  busqueda: string = '';
  resultados: any[] = [];
  cargando: boolean = false;
  necesitaConexion: boolean = false;

  private searchSubject = new Subject<string>();
  private immediateSearchSubject = new Subject<string>();

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

    // 3. BUSCADOR CON REFRESCO FORZADO
    const typing$ = this.searchSubject.pipe(
      filter(term => !!term && term.trim().length > 0),
      debounceTime(500)
    );

    const immediate$ = this.immediateSearchSubject.pipe(
      filter(term => !!term && term.trim().length > 0)
    );

    merge(typing$, immediate$).pipe(
      distinctUntilChanged(), // Evita buscar lo mismo dos veces seguidas
      tap(() => {
        this.ngZone.run(() => { 
          this.cargando = true; 
          this.playlistSeleccionada = null;
          this.cdr.detectChanges(); // FORZAR VISTA: MOSTRAR SPINNER
        });
      }),
      switchMap((term) => {
        return this.spotifyService.search(term, this.usuario.id, 'playlist').pipe(
           catchError((err) => {
             if (err.status === 400 || err.status === 401 || err.status === 500) {
                this.necesitaConexion = true;
                this.statusMessage = "⚠️ Tu sesión de Spotify ha caducado.";
             }
             return of([]); 
           }),
           finalize(() => {
             this.ngZone.run(() => { 
                this.cargando = false; 
                this.cdr.detectChanges(); // FORZAR VISTA: OCULTAR SPINNER (Incluso si se cancela)
             });
           })
        );
      })
    ).subscribe({
      next: (res: any) => {
        this.ngZone.run(() => {
          if (res && res.playlists && res.playlists.items) {
             this.resultados = res.playlists.items
                .filter((p: any) => p && p.id && p.name && p.tracks && p.tracks.total > 0)
                .map((item: any) => ({ ...item, imgLoaded: false }));
          } else {
             this.resultados = [];
          }
          this.cdr.detectChanges(); // FORZAR VISTA: MOSTRAR RESULTADOS
        });
      },
      error: (e) => {
        console.error(e);
        this.ngZone.run(() => {
            this.cargando = false;
            this.cdr.detectChanges(); // FORZAR VISTA EN ERROR
        });
      }
    });
  }

  checkConexion() {
    this.spotifyService.getToken(this.usuario.id).subscribe({
      next: () => this.necesitaConexion = false,
      error: () => this.necesitaConexion = true
    });
  }

  onTyping() {
    if (this.busqueda && this.busqueda.trim().length > 0) {
      this.searchSubject.next(this.busqueda);
    }
  }

  forceSearch() {
    // Timeout para asegurar que el valor del input ha llegado a la variable 'busqueda'
    setTimeout(() => {
        if (this.busqueda && this.busqueda.trim().length > 0) {
            this.immediateSearchSubject.next(this.busqueda);
        }
    }, 10);
  }

  conectarSpotify() {
    this.spotifyService.getAuthUrl(this.usuario.id).subscribe({
      next: (res: any) => {
        if (res && res.url) window.location.href = res.url; 
        else alert("Error: URL de conexión inválida.");
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