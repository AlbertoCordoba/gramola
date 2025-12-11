import { Component, inject } from '@angular/core';
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

  loginData = {
    email: '',
    password: ''
  };

  errorMessage: string = '';

  onLogin() {
    this.barService.login(this.loginData).subscribe({
      next: (res: any) => {
        localStorage.setItem('usuarioBar', JSON.stringify(res));
        // REDIRIGIR A CONFIGURACIÓN PRIMERO
        this.router.navigate(['/config-audio']);
      },
      error: (err: any) => {
        this.errorMessage = 'Email o contraseña incorrectos';
      }
    });
  }
}