import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, CommonModule],
  template: `
    <div class="container">
      <div class="card">
        <h2>Nueva Contraseña</h2>
        <p>Escribe tu nueva clave de acceso.</p>
        
        <input type="password" [(ngModel)]="password" placeholder="Nueva contraseña">
        <button (click)="cambiar()">Actualizar Contraseña</button>
      </div>
    </div>
  `,
  styles: [`
    .container { display: flex; justify-content: center; align-items: center; height: 100vh; background: #f0f2f5; }
    .card { background: white; padding: 40px; border-radius: 10px; width: 100%; max-width: 400px; text-align: center; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
    h2 { color: #1ed760; }
    input { width: 100%; padding: 12px; margin: 15px 0; border: 1px solid #ccc; border-radius: 5px; box-sizing: border-box; }
    button { width: 100%; padding: 12px; background: #191414; color: white; border: none; border-radius: 25px; cursor: pointer; font-weight: bold; }
  `]
})
export class ResetPasswordComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  
  token: string = '';
  password: string = '';

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.token = params['token'];
    });
  }

  cambiar() {
    this.http.post('http://localhost:8080/api/bares/reset-password', { 
      token: this.token, 
      password: this.password 
    }).subscribe({
      next: () => {
        alert('Contraseña actualizada con éxito. Por favor inicia sesión.');
        this.router.navigate(['/login']);
      },
      error: (err) => alert('Error: ' + (err.error?.error || 'Token inválido'))
    });
  }
}