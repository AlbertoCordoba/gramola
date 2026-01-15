import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-recuperar-password',
  standalone: true, // Componente moderno, sin módulos
  imports: [FormsModule, CommonModule, RouterLink], // Importamos FormsModule para usar [(ngModel)]
  templateUrl: './recuperar-password.component.html',
  styleUrl: './recuperar-password.component.css'
})
export class RecuperarPasswordComponent {
  // --- INYECCIÓN DE DEPENDENCIAS ---
  private http = inject(HttpClient); // Cliente para hablar con Spring Boot
  private router = inject(Router);   // Para redirigir al usuario al acabar
  private cdr = inject(ChangeDetectorRef); // Para refrescar la pantalla manualmente

  // --- MODELO DE DATOS ---
  email: string = ''; // Dato que introduce el usuario (Two-Way Binding)
  
  // Variables de control de interfaz
  enviado: boolean = false;  // ¿Hemos terminado con éxito?
  errorMsg: string = '';     // Mensaje de error si falla (ej: "Email no existe")
  cargando: boolean = false; // Estado de espera (spinner en botón)

  // --- LÓGICA DE NEGOCIO ---
  enviar() {
    // 1. Validación básica: No enviamos nada si el campo está vacío
    if (!this.email) return;

    // 2. Activamos estado de carga (Feedback visual inmediato)
    this.cargando = true;
    this.errorMsg = ''; // Limpiamos errores previos

    // 3. Petición al Backend
    // Enviamos un JSON { "email": "usuario@bar.com" }
    this.http.post('http://localhost:8080/api/bares/recuperar-password', { email: this.email })
      .subscribe({
        next: (res: any) => {
          // --- ÉXITO ---
          // El servidor ha encontrado el email y ha enviado el correo.
          
          this.cargando = false;
          this.enviado = true; // Esto cambia el HTML para mostrar el mensaje de "Correo Enviado"
          
          // ¡IMPORTANTE! Forzamos a Angular a pintar la nueva vista AHORA MISMO.
          // A veces en operaciones asíncronas la UI se queda "congelada" unos milisegundos sin esto.
          this.cdr.detectChanges();

          // 4. Redirección automática (UX Amigable)
          // Damos 4 segundos al usuario para leer el mensaje de éxito antes de mandarlo al Login.
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 4000);
        },
        error: (err) => {
          // --- ERROR ---
          // El email no existe o el servidor de correo falló.
          this.cargando = false;
          this.errorMsg = 'No pudimos enviar el correo. Inténtalo de nuevo.';
          this.enviado = false; // Nos aseguramos de seguir mostrando el formulario
          this.cdr.detectChanges();
        }
      });
  }
}