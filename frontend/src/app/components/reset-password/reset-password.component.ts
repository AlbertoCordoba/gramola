/*
 * ======================================================================================
 * RESUMEN
 * ======================================================================================
 * * ¿QUÉ ES ESTA CLASE?
 * Es el componente final del flujo de recuperación de contraseña ('ResetPasswordComponent').
 * Se carga cuando el usuario hace clic en el enlace de su correo (ej: /reset-password?token=XYZ).
 *
 * * PUNTOS CLAVE:
 * 1. EXTRACCIÓN DE TOKEN (ActivatedRoute):
 * Nada más cargar (ngOnInit), capturamos el parámetro 'token' de la URL.
 * Este token es la "llave" que valida que el usuario viene de un correo legítimo y no
 * está intentando hackear la cuenta de otro.
 *
 * 2. SEGURIDAD EN EL ENVÍO:
 * Al pulsar "Actualizar", enviamos al Backend el token (quién soy) y la nueva contraseña.
 * El servidor verificará si el token es válido y no ha caducado antes de permitir el cambio.
 *
 * 3. RETROALIMENTACIÓN (Feedback):
 * - Éxito: Mostramos una alerta y redirigimos al Login para que el usuario entre con su nueva clave.
 * - Error: Informamos si el token es inválido o ha expirado, guiando al usuario.
 * ======================================================================================
 */

import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, CommonModule], // FormsModule para vincular el input de password
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css'
})
export class ResetPasswordComponent implements OnInit {
  // --- INYECCIÓN DE DEPENDENCIAS ---
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute); // Para leer la URL actual
  private router = inject(Router);        // Para navegar al Login al terminar
  
  // Variables de estado
  token: string = '';    // El código de seguridad que viene en la URL
  password: string = ''; // La nueva contraseña que escribe el usuario

  ngOnInit() {
    // 1. CAPTURA DEL TOKEN
    // Nos suscribimos a los 'queryParams' de la ruta activa.
    // Buscamos el parámetro '?token=...' que generó el Backend en el paso anterior.
    this.route.queryParams.subscribe(params => {
      this.token = params['token'];
      // Nota: Si no hay token, el Backend rechazará cualquier intento de cambio.
    });
  }

  cambiar() {
    // Validación básica en cliente
    if (!this.password) return;

    // 2. PETICIÓN DE CAMBIO
    // Enviamos el objeto con la credencial de seguridad (token) y la nueva clave.
    this.http.post('http://localhost:8080/api/bares/reset-password', { 
      token: this.token, 
      password: this.password 
    }).subscribe({
      next: () => {
        // --- ÉXITO ---
        // El servidor aceptó el cambio. La contraseña antigua ya no sirve.
        alert('Contraseña actualizada con éxito. Por favor inicia sesión.');
        
        // Redirigimos al usuario al punto de entrada para que pruebe su nueva clave
        this.router.navigate(['/login']);
      },
      error: (err) => {
        // --- ERROR ---
        // El token era falso, ya se había usado, o había caducado (seguridad).
        // Mostramos el mensaje exacto que devuelve el servidor o un genérico.
        alert('Error: ' + (err.error?.error || 'Token inválido o expirado'));
      }
    });
  }
}