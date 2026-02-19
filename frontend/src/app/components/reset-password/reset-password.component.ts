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

  // MÉTODO DE INICIO: Captura automáticamente el token del enlace que el usuario pulsó en su email.
  // Sin este parámetro (?token=...), el componente no podrá autorizar el cambio en el servidor.
  ngOnInit() {
    // 1. CAPTURA DEL TOKEN
    // Nos suscribimos a los 'queryParams' de la ruta activa.
    // Buscamos el parámetro '?token=...' que generó el Backend en el paso anterior.
    this.route.queryParams.subscribe(params => {
      this.token = params['token'];
      // Nota: Si no hay token, el Backend rechazará cualquier intento de cambio.
    });
  }
  // MÉTODO PRINCIPAL: Envía la nueva contraseña y el token al Backend. 
  // Si Java confirma que el token es válido y no ha expirado, actualiza la base de datos.
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