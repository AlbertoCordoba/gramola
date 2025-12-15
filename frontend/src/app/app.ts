import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  private router = inject(Router);
  
  usuario: any = null;
  isPublicPage: boolean = true; // Para saber si estamos en Login/Registro

  ngOnInit() {
    // 1. Escuchar cambios de ruta para actualizar el Header
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.checkLoginStatus();
      this.checkPublicPage(event.url);
    });

    this.checkLoginStatus();
  }

  checkLoginStatus() {
    const userJson = localStorage.getItem('usuarioBar');
    this.usuario = userJson ? JSON.parse(userJson) : null;
  }

  checkPublicPage(url: string) {
    // Si la URL contiene estas palabras, es una página pública (sin perfil de usuario)
    const publicRoutes = ['/login', '/registro', '/recuperar', '/reset', '/pasarela'];
    this.isPublicPage = publicRoutes.some(route => url.includes(route));
  }

  logout() {
    localStorage.removeItem('usuarioBar');
    localStorage.removeItem('playlistFondo');
    this.usuario = null;
    this.router.navigate(['/login']);
  }
}