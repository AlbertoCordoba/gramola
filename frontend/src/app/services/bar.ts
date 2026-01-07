/*
 * ======================================================================================
 * RESUMEN
 * ======================================================================================
 * Servicio encargado de la autenticación y registro de los dueños de bares.
 * Actúa como cliente HTTP para los endpoints '/api/bares' del Backend.
 * ======================================================================================
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/*
 * @Injectable({ providedIn: 'root' }):
 * Patrón Singleton. Significa que Angular crea UNA sola instancia de este servicio
 * al arrancar la aplicación y la comparte con todos los componentes que la necesiten.
 * No hace falta añadirlo a 'providers' en cada componente.
 */
@Injectable({
  providedIn: 'root'
})
export class BarService {
  // Inyección de dependencias moderna (función inject() en lugar de constructor).
  // HttpClient es la herramienta de Angular para hacer peticiones AJAX (XHR).
  private http = inject(HttpClient);
  
  // URL base del controlador de Bares en Spring Boot.
  // En producción, esto debería estar en un archivo de environment.ts.
  private apiUrl = 'http://localhost:8080/api/bares';

  constructor() { }

  /*
   * LOGIN
   * Envía las credenciales (email/pass) y la ubicación (lat/lng).
   * Retorna un Observable (flujo de datos asíncrono). El componente se suscribirá (.subscribe)
   * a este flujo para recibir la respuesta cuando el servidor conteste.
   */
  login(datos: any): Observable<any> {
    // POST: Enviamos datos sensibles en el cuerpo de la petición, no en la URL.
    return this.http.post(`${this.apiUrl}/login`, datos);
  }

  /*
   * REGISTRO
   * Envía el formulario completo de alta, incluyendo la firma en Base64.
   */
  registro(datos: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/registro`, datos);
  }
}