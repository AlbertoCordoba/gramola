import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-recuperar-password',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './recuperar-password.component.html',
  styleUrl: './recuperar-password.component.css'
})
export class RecuperarPasswordComponent {
  private http = inject(HttpClient);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef); // 1. Inyectamos el detector de cambios

  email: string = '';
  enviado: boolean = false;
  errorMsg: string = '';
  cargando: boolean = false;

  enviar() {
    if (!this.email) return;

    this.cargando = true;
    this.errorMsg = '';

    this.http.post('http://localhost:8080/api/bares/recuperar-password', { email: this.email })
      .subscribe({
        next: (res: any) => {
          // 2. Cambiamos estado
          this.cargando = false;
          this.enviado = true;
          
          // 3. ¡IMPORTANTE! Forzamos a Angular a pintar la pantalla AHORA MISMO
          this.cdr.detectChanges();

          // 4. Esperamos 4 segundos para que le dé tiempo a leer
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 4000);
        },
        error: (err) => {
          this.cargando = false;
          this.errorMsg = 'No pudimos enviar el correo. Inténtalo de nuevo.';
          this.enviado = false;
          this.cdr.detectChanges();
        }
      });
  }
}