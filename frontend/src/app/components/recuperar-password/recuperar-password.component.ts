import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-recuperar-password',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink],
  template: `
    <div class="container">
      <div class="glass-card">
        <h2>Recuperar Contraseña</h2>
        <p>Introduce tu email y te enviaremos un enlace.</p>
        <div class="form-group"><input type="email" [(ngModel)]="email" placeholder="hola@bar.com"></div>
        <button (click)="enviar()">Enviar Enlace</button>
        <div *ngIf="mensaje" class="msg">{{ mensaje }}</div>
        <div class="back-link"><a routerLink="/login">← Volver al Login</a></div>
      </div>
    </div>
  `,
  styles: [`
    .container { display: flex; justify-content: center; align-items: center; height: 100vh; }
    .glass-card {
      background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1); padding: 40px; border-radius: 16px;
      width: 100%; max-width: 400px; text-align: center; color: white;
    }
    h2 { color: #1ed760; margin-bottom: 10px; }
    p { color: #b3b3b3; margin-bottom: 20px; }
    input { width: 100%; padding: 12px; margin-bottom: 20px; box-sizing: border-box; }
    button { width: 100%; padding: 12px; background: #1ed760; border: none; border-radius: 30px; cursor: pointer; font-weight: bold; font-size: 1rem; }
    .msg { margin-top: 15px; color: #1ed760; }
    .back-link { margin-top: 25px; } a { color: #b3b3b3; text-decoration: none; }
  `]
})
export class RecuperarPasswordComponent {
  private http = inject(HttpClient);
  email: string = '';
  mensaje: string = '';
  enviar() {
    this.http.post('http://localhost:8080/api/bares/recuperar-password', { email: this.email })
      .subscribe({ next: (res: any) => this.mensaje = res.mensaje, error: () => this.mensaje = 'Error al enviar.' });
  }
}