import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { BarService } from '../../services/bar';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [FormsModule, RouterLink, CommonModule],
  templateUrl: './registro.html',
  styleUrl: './registro.css'
})
export class Registro {
  private barService = inject(BarService);
  private router = inject(Router);

  registroData = {
    nombre: '',
    email: '',
    password: '',
    confirmPassword: '',
    latitud: 0,
    longitud: 0
  };

  errorMessage: string = '';
  successMessage: string = '';

  // BONUS: Obtener ubicación del navegador
  obtenerUbicacion() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        this.registroData.latitud = position.coords.latitude;
        this.registroData.longitud = position.coords.longitude;
        alert(`Ubicación detectada: ${this.registroData.latitud}, ${this.registroData.longitud}`);
      }, (error) => {
        console.error(error);
        alert('No se pudo obtener la ubicación. Verifica los permisos.');
      });
    } else {
      alert('Tu navegador no soporta geolocalización.');
    }
  }

  onRegistro() {
    // Validación simple de contraseñas
    if (this.registroData.password !== this.registroData.confirmPassword) {
      this.errorMessage = 'Las contraseñas no coinciden.';
      return;
    }

    // Llamada al backend
    this.barService.registro(this.registroData).subscribe({
      next: (res: any) => {
        console.log('Registro correcto:', res);
        this.successMessage = '¡Cuenta creada con éxito! Redirigiendo...';
        this.errorMessage = '';
        
        // Esperar 2 segundos y redirigir al login
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2000);
      },
      error: (err: any) => {
        console.error('Error en registro:', err);
        this.errorMessage = 'Error al registrar. El email podría estar en uso.';
      }
    });
  }
}