import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BarService {
  // Inyectamos el cliente HTTP
  private http = inject(HttpClient);
  
  // URL de tu Backend (Spring Boot)
  private apiUrl = 'http://localhost:8080/api/bares';

  constructor() { }

  // Función Login
  login(datos: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, datos);
  }

  // Función Registro
  registro(datos: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/registro`, datos);
  }
}