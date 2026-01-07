/*
 * ======================================================================================
 * RESUMEN
 * ======================================================================================
 * * ¿QUÉ ES ESTA CLASE?
 * Es el componente de inicio de sesión ('LoginComponent').
 * Su responsabilidad no es solo enviar usuario y contraseña, sino garantizar la
 * seguridad física del acceso mediante geolocalización.
 *
 * * PUNTOS CLAVE:
 * 1. SEGURIDAD CONTEXTUAL (Geolocalización):
 * Antes de permitir el login, obligamos al navegador a obtener las coordenadas GPS.
 * Si el usuario bloquea el permiso o el hardware falla, el proceso se detiene.
 * Esto evita ataques remotos: aunque un hacker robe la contraseña, no podrá entrar
 * si no está físicamente en las coordenadas del bar (validado luego en el Backend).
 *
 * 2. GESTIÓN DE ZONAS (ChangeDetectorRef):
 * La API de Geolocation del navegador es asíncrona y externa a Angular.
 * Cuando el callback de posición responde, a veces Angular "no se entera" de que debe
 * actualizar la vista (quitar el spinner, mostrar error). Usamos 'cdr.detectChanges()'
 * para forzar manualmente el repintado de la interfaz y asegurar una UX fluida.
 *
 * 3. INYECCIÓN MODERNA (inject):
 * Utilizamos la función 'inject()' introducida en Angular 14+. Esto hace el código
 * más limpio y legible que la inyección tradicional por constructor, facilitando
 * la herencia de clases si fuera necesaria en el futuro.
 * ======================================================================================
 */

import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { BarService } from '../../services/bar';

@Component({
  selector: 'app-login',
  standalone: true, // Componente autónomo, no depende de un NgModule.
  imports: [FormsModule, RouterLink, CommonModule], // Importamos lo necesario para el HTML (ngIf, ngModel, routerLink).
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  // --- INYECCIÓN DE DEPENDENCIAS ---
  // Servicio para comunicar con el API Backend (Spring Boot).
  private barService = inject(BarService);
  // Servicio para navegar entre páginas.
  private router = inject(Router);
  // Servicio para forzar la actualización de la vista (necesario por la API de GPS).
  private cdr = inject(ChangeDetectorRef);

  // --- MODELO DE DATOS ---
  // Objeto que se vincula con el formulario HTML mediante [(ngModel)].
  loginData = {
    email: '',
    password: '',
    lat: null as number | null, // Se rellenará automáticamente con el GPS
    lng: null as number | null
  };

  // Variables de estado para la interfaz
  errorMessage: string = '';
  cargando: boolean = false; // Controla el estado del botón (spinner/disabled)

  // --- MÉTODO PRINCIPAL: EJECUTAR LOGIN ---
  onLogin() {
    this.errorMessage = '';
    this.cargando = true; // Bloqueamos el botón para evitar doble envío

    // 1. SOLICITUD DE UBICACIÓN FÍSICA (API Nativa del Navegador)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        // Callback de ÉXITO
        (pos) => {
          // Capturamos coordenadas con alta precisión
          this.loginData.lat = pos.coords.latitude;
          this.loginData.lng = pos.coords.longitude;
          
          // Una vez tenemos la ubicación segura, procedemos a llamar al servidor
          this.enviarPeticionLogin();
        },
        // Callback de ERROR (Permiso denegado, Timeout, GPS apagado)
        (err) => {
          this.cargando = false;
          console.error(err);
          this.errorMessage = '❌ Acceso denegado: Necesitamos tu ubicación para verificar que estás en el bar.';
          
          // IMPORTANTE: Al estar en un callback nativo (fuera de la "Zona Angular"),
          // forzamos la detección de cambios para que el usuario vea el mensaje de error inmediatamente.
          this.cdr.detectChanges();
        },
        // Opciones de geolocalización
        { 
          enableHighAccuracy: true, // Intentar usar GPS real, no solo IP
          timeout: 5000 // Si tarda más de 5s, cancelar (evita que la app se cuelgue)
        }
      );
    } else {
      // Fallback para navegadores muy antiguos (raro hoy en día)
      this.cargando = false;
      this.errorMessage = 'Tu navegador no soporta geolocalización.';
      this.cdr.detectChanges();
    }
  }

  // --- COMUNICACIÓN CON BACKEND ---
  enviarPeticionLogin() {
    // Llamamos al servicio 'BarService', que hace el POST a Spring Boot.
    // Enviamos email, password y coordenadas.
    this.barService.login(this.loginData).subscribe({
      next: (res: any) => {
        // ÉXITO: El backend ha validado credenciales y distancia (<100m).
        
        // Guardamos la sesión en el navegador.
        // 'usuarioBar' contiene el token y los datos básicos (nombre, id).
        localStorage.setItem('usuarioBar', JSON.stringify(res));
        
        // Redirigimos al panel de configuración de audio.
        this.router.navigate(['/config-audio']);
      },
      error: (err: any) => {
        // ERROR: Credenciales mal o ubicación lejana.
        this.cargando = false;
        
        // Si el backend envía un mensaje específico (ej: "Estás muy lejos"), lo mostramos.
        if (err.error && err.error.error) {
          this.errorMessage = err.error.error;
        } else {
          this.errorMessage = 'Email o contraseña incorrectos.';
        }
        
        // Forzamos actualización de vista por si acaso.
        this.cdr.detectChanges();
      }
    });
  }
}