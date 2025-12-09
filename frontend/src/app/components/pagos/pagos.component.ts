import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

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
  
  precios: any = {};
  emailUsuario: string = '';
  cargando: boolean = true;
  errorMensaje: string = '';

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['verificado']) {
        console.log("Usuario verificado, esperando selección de pago.");
      }
    });
    this.cargarPrecios();
  }

  cargarPrecios() {
    this.http.get('http://localhost:8080/api/bares/precios').subscribe({
      next: (res: any) => {
        // Normalizamos claves a mayúsculas
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

    this.http.post('http://localhost:8080/api/bares/suscripcion', {
      email: this.emailUsuario,
      tipo: tipo
    }).subscribe({
      next: () => {
        alert('¡Suscripción activada! Ya puedes iniciar sesión.');
        this.router.navigate(['/login']);
      },
      error: (err) => alert('Error: ' + (err.error?.error || 'No se pudo activar.'))
    });
  }
}