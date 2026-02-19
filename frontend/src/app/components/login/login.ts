import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { BarService } from '../../services/bar';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent { 
  // NOTA: 'export class' es OBLIGATORIO para que otros archivos lo vean
  private barService = inject(BarService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  // OBJETO: Almacena las credenciales y las coordenadas que se enviarán al Backend.
  loginData = {
    email: '',
    password: '',
    lat: null as number | null,
    lng: null as number | null
  };

  errorMessage: string = '';
  cargando: boolean = false;
  // MÉTODO: Punto de entrada al pulsar "Login". Primero intenta obtener la ubicación del usuario.
  // 1. Activa el estado de carga.
  // 2. Solicita permiso de ubicación al navegador.
  // 3. Si el usuario acepta, guarda las coordenadas y llama a la petición de login.
  onLogin() {
    this.errorMessage = '';
    this.cargando = true;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.loginData.lat = pos.coords.latitude;
          this.loginData.lng = pos.coords.longitude;
          this.enviarPeticionLogin();
        },
        (err) => {
          this.cargando = false;
          console.error(err);
          this.errorMessage = '❌ Acceso denegado: Necesitamos tu ubicación.';
          this.cdr.detectChanges();
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      this.cargando = false;
      this.errorMessage = 'Tu navegador no soporta geolocalización.';
      this.cdr.detectChanges();
    }
  }
  // MÉTODO: Envía los datos al Backend. Si el login es correcto, guarda el usuario en 'localStorage' 
  // y redirige a la pantalla principal (Gramola).
  enviarPeticionLogin() {
    this.barService.login(this.loginData).subscribe({
      next: (res: any) => {
        localStorage.setItem('usuarioBar', JSON.stringify(res));
        // Redirige a donde corresponda en el flujo
        this.router.navigate(['/gramola']); 
      },
      error: (err: any) => {
        this.cargando = false;
        if (err.error && err.error.error) {
          this.errorMessage = err.error.error;
        } else {
          this.errorMessage = 'Email o contraseña incorrectos.';
        }
        this.cdr.detectChanges();
      }
    });
  }
}