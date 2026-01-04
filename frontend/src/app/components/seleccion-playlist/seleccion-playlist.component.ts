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
  private spotifyService = inject(SpotifyConnectService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  usuario: any = null;
  spotifyConnected: boolean = false;
  
  searchControl = new FormControl('');
  
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

    this.setupLiveSearch();
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

  // --- BÚSQUEDA EN VIVO MEJORADA ---
  setupLiveSearch() {
    this.searchControl.valueChanges.pipe(
      // CAMBIO 1: Permitir búsqueda desde 1 carácter
      filter(text => (text || '').trim().length > 0),
      
      // CAMBIO 2: Debounce de 300ms
      debounceTime(300),
      distinctUntilChanged(),
      
      tap(() => {
        this.ngZone.run(() => {
          this.cargando = true;
          this.resultados = [];
          this.cdr.detectChanges();
        });
      }),
      
      switchMap(term => {
        const busqueda = term!;
        
        // A) URL de Spotify
        if (busqueda.includes('spotify.com') || busqueda.includes('spotify.com/playlist')) {
          let playlistId = '';
          try {
            const partes = busqueda.split('playlist/');
            if (partes.length > 1) {
              playlistId = partes[1].split('?')[0];
            }
          } catch (e) { console.error("Error URL", e); }

          if (playlistId) {
            return this.spotifyService.getPlaylist(playlistId, this.usuario.id).pipe(
              catchError(() => of(null))
            );
          }
          return of(null);
        } 
        
        // B) Búsqueda normal
        else {
          return this.spotifyService.search(busqueda, this.usuario.id, 'playlist').pipe(
            catchError(() => of(null))
          );
        }
      })
    ).subscribe({
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

  procesarResultados(res: any) {
    if (!res) {
      this.resultados = [];
      return;
    }

    if (res.id && res.tracks && !res.playlists) {
      if (res.tracks.total > 0) {
        this.resultados = [res];
      } else {
        this.resultados = [];
      }
    }
    else if (res.playlists && res.playlists.items) {
      const items = res.playlists.items || [];
      this.resultados = items.filter((p: any) => 
        p && p.tracks && p.tracks.total > 0 && p.uri
      );
    }
    else {
      this.resultados = [];
    }
  }

  buscar() {
    const val = this.searchControl.value;
    if (val && val.trim().length > 0) { // CAMBIO: > 0
      this.searchControl.setValue(val);
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