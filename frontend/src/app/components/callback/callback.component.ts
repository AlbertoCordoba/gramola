import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SpotifyConnectService } from '../../services/spotify.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="height: 100vh; display: flex; justify-content: center; align-items: center; background: #000; color: white;">
      <h2>🔄 Vinculando cuenta...</h2>
    </div>
  `
})
export class CallbackComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private spotifyService = inject(SpotifyConnectService);

  // Variable para evitar doble llamada
  private procesando = false;

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const code = params['code'];
      const state = params['state'];

      if (this.procesando) return; // Si ya estamos trabajando, ignorar

      if (code && state) {
        this.procesando = true; // Bloqueamos nuevas llamadas

        this.spotifyService.enviarCodigoAlBackend(code, state).subscribe({
          next: () => {
            this.router.navigate(['/config-audio'], { queryParams: { status: 'success' } });
          },
          error: () => {
            this.procesando = false;
            this.router.navigate(['/config-audio'], { queryParams: { status: 'error' } });
          }
        });
      } else {
        this.router.navigate(['/login']);
      }
    });
  }
}