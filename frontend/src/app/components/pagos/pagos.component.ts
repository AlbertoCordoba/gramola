import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { PagoStateService } from '../../services/pago-state.service';

@Component({
  selector: 'app-pagos',
  standalone: true,
  imports: [CommonModule, FormsModule], // FormsModule necesario para el [(ngModel)] del email
  templateUrl: './pagos.component.html',
  styleUrl: './pagos.component.css'
})
export class PagosComponent implements OnInit {
  // --- INYECCIÓN DE DEPENDENCIAS ---
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute); // Para leer parámetros de la URL (?verificado=true)
  private pagoState = inject(PagoStateService); // Servicio puente para pasar datos a la pasarela
  
  // Variables de estado
  precios: any = {};
  emailUsuario: string = '';
  cargando: boolean = true; // Controla el spinner de carga inicial
  errorMensaje: string = '';

  ngOnInit() {
    // 1. Detección de retorno de verificación
    // Si la URL es /pagos?verificado=true, sabemos que acaba de confirmar su email
    this.route.queryParams.subscribe(params => {
      if (params['verificado']) {
        console.log("Usuario verificado correctamente.");
  // Este flujo no debe reutilizar una sesión previa (si existía).
  localStorage.removeItem('usuarioBar');
        // Aquí podríamos mostrar un toast/notificación de "Email verificado"
      }
    });

    // 2. Carga de datos
    this.cargarPrecios();
  }

  cargarPrecios() {
    // Llamada GET al backend para obtener la configuración de precios actualizada
    this.http.get('http://localhost:8080/api/bares/precios').subscribe({
      next: (res: any) => {
        // --- NORMALIZACIÓN DE DATOS ---
        // Convertimos las claves a mayúsculas y quitamos espacios para evitar errores humanos
        // al acceder a precios['SUSCRIPCION_MENSUAL'] si en BD viene como 'suscripcion_mensual '.
        const preciosNormalizados: any = {};
        for (const key in res) {
            if (res[key]) {
                preciosNormalizados[key.toUpperCase().trim()] = res[key];
            }
        }
        this.precios = preciosNormalizados;

        // Validación básica para asegurar que la UI no se rompa
        if (this.precios['SUSCRIPCION_MENSUAL']) {
            this.cargando = false;
        } else {
            this.cargando = false;
            this.errorMensaje = "No se encontraron los precios en la base de datos.";
        }
      },
      error: (err) => {
        console.error(err);
        this.cargando = false;
        this.errorMensaje = "Error conectando con el servidor. Intenta más tarde.";
      }
    });
  }

  // Método invocado al hacer clic en "Elegir Plan"
  pagar(tipo: string) {
    // Validación simple del campo email
    if (!this.emailUsuario) {
      alert('Introduce tu email para continuar.');
      return;
    }

    // --- GUARDADO DE ESTADO (State Management) ---
    // En lugar de pasar precio y concepto por URL (que se puede manipular),
    // lo guardamos en un servicio singleton en memoria.
    this.pagoState.setPago({
      concepto: tipo === 'SUSCRIPCION_MENSUAL' ? 'Suscripción Mensual' : 'Suscripción Anual',
      precio: this.precios[tipo], // Usamos el precio real cargado del servidor
      tipo: 'SUSCRIPCION',
      payload: {
        email: this.emailUsuario, // Identificador para activar al usuario en BD
        tipo: tipo
      }
    });

    // Navegación limpia a la pantalla de la tarjeta de crédito
    this.router.navigate(['/pasarela']);
  }
}