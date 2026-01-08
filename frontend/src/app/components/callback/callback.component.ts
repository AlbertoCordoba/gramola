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

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const code = params['code'];
      const userId = params['state'];

      if (code && userId) {
        this.spotifyService.enviarCodigoAlBackend(code, userId).subscribe({
          next: () => this.router.navigate(['/config-audio'], { queryParams: { status: 'success' } }),
          error: () => this.router.navigate(['/config-audio'], { queryParams: { status: 'error' } })
        });
      } else {
        this.router.navigate(['/login']);
      }
    });
  }
}