/*
 * ======================================================================================
 * RESUMEN
 * ======================================================================================
 * * ¿QUÉ ES ESTA CLASE?
 * Es un componente auxiliar diseñado para manejar la redirección de OAuth 2.0.
 *
 * * PUNTOS CLAVE TÉCNICOS:
 * 1. PARSEO DE URL (Fragmentos):
 * A diferencia de los parámetros normales (?id=1), los tokens de acceso en flujos
 * implícitos vienen en el "hash" de la URL (#access_token=XYZ).
 * Este componente captura ese fragmento, lo limpia y extrae el token.
 *
 * 2. PERSISTENCIA LOCAL:
 * Usa 'localStorage' para guardar el token. Esto permite que la sesión persista
 * incluso si el usuario recarga la página.
 * ======================================================================================
 */

import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-callback',
  template: '<p>Conectando con Spotify...</p>'
})
export class CallbackComponent implements OnInit {
  constructor(private router: Router) {}

  ngOnInit() {
    // 1. OBTENCIÓN DEL HASH
    // window.location.hash devuelve algo como "#access_token=BQD..."
    // .substring(1) elimina el carácter "#" inicial para dejar solo los datos.
    const hash = window.location.hash.substring(1);

    // 2. PARSEO DE PARÁMETROS
    // Usamos la API nativa 'URLSearchParams' para convertir la cadena de texto
    // en un objeto manejable donde podemos pedir valores por clave (.get()).
    const params = new URLSearchParams(hash);
    
    // 3. EXTRACCIÓN
    const accessToken = params.get('access_token');

    if (accessToken) {
      // 4. ALMACENAMIENTO SEGURO
      // Guardamos el token en el navegador. Es crítico para que los Servicios
      // puedan inyectarlo luego en las cabeceras Authorization de las peticiones HTTP.
      localStorage.setItem('spotify_access_token', accessToken);
      
      // 5. REDIRECCIÓN
      // Navegamos a la raíz ('/') para iniciar la app ya autenticada.
      this.router.navigate(['/']); 
    }
  }
}