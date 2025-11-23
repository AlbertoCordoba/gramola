import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms'; // Necesario para leer los inputs
import { Router, RouterLink } from '@angular/router';
import { BarService } from '../../services/bar.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, CommonModule], // Importamos módulos necesarios
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  // Inyecciones de dependencias
  private barService = inject(BarService);
  private router = inject(Router);

  // Objeto donde guardamos lo que escribe el usuario
  loginData = {
    email: '',
    password: ''
  };

  errorMessage: string = '';

  // Esta función se ejecuta al pulsar "Entrar"
  onLogin() {
    this.barService.login(this.loginData).subscribe({
      next: (res: any) => {
        console.log('Login correcto:', res);
        
        // Guardamos el usuario en el navegador (localStorage) para no perderlo al recargar
        localStorage.setItem('usuarioBar', JSON.stringify(res));
        
        // Mensaje temporal de éxito
        alert('¡Bienvenido ' + res.nombre + '!');
        
        // TODO: Aquí redirigiremos al panel principal en el futuro
        // this.router.navigate(['/dashboard']); 
      },
      error: (err: any) => {
        console.error('Error:', err);
        this.errorMessage = 'Email o contraseña incorrectos';
      }
    });
  }
}