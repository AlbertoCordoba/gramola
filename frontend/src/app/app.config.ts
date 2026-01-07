/*
 * ======================================================================================
 * RESUMEN
 * ======================================================================================
 * Archivo de configuración para Angular Standalone. Aquí registramos los servicios
 * globales que estarán disponibles en toda la aplicación.
 * ======================================================================================
 */

import { ApplicationConfig } from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // 1. CONFIGURACIÓN DEL ROUTER
    // Pasamos el array de rutas importado arriba.
    // 'withViewTransitions()': Activa la API nativa de View Transitions del navegador.
    // Esto hace que al cambiar de página (ej: de Login a Gramola), haya una animación
    // de fundido suave (fade) automática sin escribir CSS complejo.
    provideRouter(routes, withViewTransitions()),
    
    // 2. CLIENTE HTTP
    // Habilita el servicio 'HttpClient' en toda la app.
    // Es OBLIGATORIO para poder usar 'this.http.get/post' en los servicios y conectar
    // con tu backend Java en el puerto 8080.
    provideHttpClient()
  ]
};