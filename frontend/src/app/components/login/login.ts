import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
// Importamos el servicio desde el archivo 'bar.ts'
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
        console.log('Login correcto:', res);
        // Guardamos el usuario en el navegador (localStorage)
        localStorage.setItem('usuarioBar', JSON.stringify(res));
        
        alert('¡Bienvenido ' + res.nombre + '!');
        // Aquí redirigiríamos al dashboard en el futuro
        // this.router.navigate(['/dashboard']); 
      },
      error: (err: any) => {
        console.error('Error:', err);
        this.errorMessage = 'Email o contraseña incorrectos';
      }
    });
  }
}