import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { PagoStateService } from '../../services/pago-state.service';

@Component({
  selector: 'app-pagos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pagos.component.html',
  styleUrl: './pagos.component.css'
})
export class PagosComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  // Inyectamos el servicio de estado
  private pagoState = inject(PagoStateService);
  
  precios: any = {};
  emailUsuario: string = '';
  cargando: boolean = true;
  errorMensaje: string = '';

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['verificado']) {
        console.log("Usuario verificado.");
      }
    });
    this.cargarPrecios();
  }

  cargarPrecios() {
    this.http.get('http://localhost:8080/api/bares/precios').subscribe({
      next: (res: any) => {
        const preciosNormalizados: any = {};
        for (const key in res) {
            if (res[key]) {
                preciosNormalizados[key.toUpperCase().trim()] = res[key];
            }
        }
        this.precios = preciosNormalizados;

        if (this.precios['SUSCRIPCION_MENSUAL']) {
            this.cargando = false;
        } else {
            this.cargando = false;
            this.errorMensaje = "No se encontraron los precios.";
        }
      },
      error: (err) => {
        console.error(err);
        this.cargando = false;
        this.errorMensaje = "Error conectando con el servidor.";
      }
    });
  }

  pagar(tipo: string) {
    if (!this.emailUsuario) {
      alert('Introduce tu email para continuar.');
      return;
    }

    // Configurar los datos para la pasarela
    this.pagoState.setPago({
      concepto: tipo === 'SUSCRIPCION_MENSUAL' ? 'Suscripción Mensual' : 'Suscripción Anual',
      precio: this.precios[tipo],
      tipo: 'SUSCRIPCION',
      payload: {
        email: this.emailUsuario,
        tipo: tipo
      }
    });

    // Redirigir a la pantalla de pago
    this.router.navigate(['/pasarela']);
  }
}