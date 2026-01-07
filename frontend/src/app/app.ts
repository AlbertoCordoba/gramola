/*
 * ======================================================================================
 * RESUMEN
 * ======================================================================================
 * Componente Raíz. Contiene la lógica para mostrar/ocultar elementos de navegación
 * basándose en la URL actual y el estado de la sesión.
 * ======================================================================================
 */

import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true, // Indica que no necesita NgModule (Angular moderno)
  imports: [RouterOutlet, CommonModule], // Importamos RouterOutlet para cargar páginas hijas
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  // Inyección de dependencias moderna (sin constructor)
  private router = inject(Router);
  
  usuario: any = null; // Almacena los datos del bar logueado (Nombre, Foto, ID)
  isPublicPage: boolean = true; // Flag para saber si ocultamos el menú de usuario

  ngOnInit() {
    // --- ESCUCHA DE CAMBIOS DE URL ---
    // Nos suscribimos a los eventos del Router para saber cuándo el usuario cambia de página.
    this.router.events.pipe(
      // Filtramos solo el evento 'NavigationEnd' (cuando la navegación ha terminado con éxito).
      // Ignoramos eventos de inicio, cancelación o error.
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      // Cada vez que cambiamos de página:
      this.checkLoginStatus();      // 1. Verificamos si hay usuario en localStorage
      this.checkPublicPage(event.url); // 2. Comprobamos si la nueva URL es pública
    });

    // Ejecución inicial al cargar la app por primera vez
    this.checkLoginStatus();
  }

  // Recupera la sesión del almacenamiento local del navegador
  checkLoginStatus() {
    const userJson = localStorage.getItem('usuarioBar');
    // Si existe, lo parseamos de String JSON a Objeto JS. Si no, es null.
    this.usuario = userJson ? JSON.parse(userJson) : null;
  }

  // Determina si estamos en una página que NO debe mostrar el perfil de usuario
  checkPublicPage(url: string) {
    // Lista negra de rutas donde el header debe ser simple
    const publicRoutes = ['/login', '/registro', '/recuperar', '/reset', '/pasarela'];
    
    // .some() devuelve true si la URL actual contiene alguna de las palabras prohibidas
    this.isPublicPage = publicRoutes.some(route => url.includes(route));
  }

  // Cierra la sesión
  logout() {
    // 1. Borrado completo de datos sensibles
    localStorage.removeItem('usuarioBar');
    localStorage.removeItem('playlistFondo');
    
    // 2. Limpieza de estado en memoria
    this.usuario = null;
    
    // 3. Redirección forzada al login
    this.router.navigate(['/login']);
  }
}