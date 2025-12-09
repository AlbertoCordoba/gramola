import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css'
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