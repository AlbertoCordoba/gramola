import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-callback',
  template: '<p>Conectando con Spotify...</p>'
})
export class CallbackComponent implements OnInit {
  constructor(private router: Router) {}

  ngOnInit() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    if (accessToken) {
      localStorage.setItem('spotify_access_token', accessToken);
      this.router.navigate(['/']); // Redirige a tu página principal
    }
  }
}
