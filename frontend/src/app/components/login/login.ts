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
  private barService = inject(BarService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  loginData = {
    email: '',
    password: '',
    lat: null as number | null,
    lng: null as number | null
  };

  errorMessage: string = '';
  cargando: boolean = false;

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
          this.errorMessage = '❌ Acceso denegado: Necesitamos tu ubicación para verificar que estás en el bar.';
          this.cdr.detectChanges();
        },
        { 
          enableHighAccuracy: true,
          timeout: 5000 
        }
      );
    } else {
      this.cargando = false;
      this.errorMessage = 'Tu navegador no soporta geolocalización.';
      this.cdr.detectChanges();
    }
  }

  enviarPeticionLogin() {
    this.barService.login(this.loginData).subscribe({
      next: (res: any) => {
        localStorage.setItem('usuarioBar', JSON.stringify(res));
        this.router.navigate(['/config-audio']);
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