import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-recuperar-password',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './recuperar-password.component.html',
  styleUrl: './recuperar-password.component.css'
})
export class RecuperarPasswordComponent {
  private http = inject(HttpClient);
  email: string = '';
  mensaje: string = '';

  enviar() {
    this.http.post('http://localhost:8080/api/bares/recuperar-password', { email: this.email })
      .subscribe({
        next: (res: any) => this.mensaje = res.mensaje,
        error: () => this.mensaje = 'Error al enviar.'
      });
  }
}