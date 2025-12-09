import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-pagos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <h2>Elige tu Suscripción</h2>
      <p class="subtitle">Verifica tu identidad e inicia tu plan.</p>
      
      <div class="auth-confirm glass-card-mini">
        <label>Confirma tu Email:</label>
        <input type="email" [(ngModel)]="emailUsuario" placeholder="ejemplo@bar.com">
      </div>

      <p *ngIf="cargando" class="loading">Cargando precios...</p>
      <p *ngIf="errorMensaje" class="error-msg">{{ errorMensaje }}</p>

      <div class="pricing-grid" *ngIf="!cargando && !errorMensaje">
        
        <div class="card glass-card">
          <h3>Mensual</h3>
          <p class="price">{{ precios?.SUSCRIPCION_MENSUAL | number:'1.2-2' }} € <span class="period">/ mes</span></p>
          <button (click)="pagar('SUSCRIPCION_MENSUAL')">Elegir Mensual</button>
        </div>

        <div class="card glass-card featured">
          <div class="badge">MEJOR VALOR</div>
          <h3>Anual</h3>
          <p class="price">{{ precios?.SUSCRIPCION_ANUAL | number:'1.2-2' }} € <span class="period">/ año</span></p>
          <p class="saving">¡Ahorra dinero!</p>
          <button (click)="pagar('SUSCRIPCION_ANUAL')" class="btn-highlight">Elegir Anual</button>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .container { max-width: 900px; margin: 0 auto; padding: 50px 20px; text-align: center; color: white; }
    h2 { font-size: 2.5rem; color: #1ed760; margin-bottom: 10px; }
    .subtitle { color: #b3b3b3; margin-bottom: 40px; }
    
    .glass-card-mini {
      background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px;
      display: inline-block; border: 1px solid rgba(255,255,255,0.1); margin-bottom: 20px;
    }
    .auth-confirm input { width: 300px; padding: 12px; }
    
    .pricing-grid { display: flex; gap: 30px; justify-content: center; flex-wrap: wrap; }
    
    .card {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 40px 30px; border-radius: 16px; width: 280px;
      position: relative; transition: transform 0.3s;
    }
    .card:hover { transform: translateY(-10px); border-color: #1ed760; }
    
    .featured { border-color: #1ed760; background: rgba(30, 215, 96, 0.05); }
    .badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #1ed760; color: black; padding: 4px 12px; border-radius: 12px; font-weight: bold; font-size: 0.8rem; }

    .price { font-size: 2.5rem; font-weight: 700; color: white; margin: 20px 0; }
    .saving { color: #1ed760; font-weight: bold; margin-bottom: 25px; }

    button {
      background: transparent; color: white; border: 2px solid white;
      padding: 12px 30px; border-radius: 30px; cursor: pointer; font-weight: bold; width: 100%;
    }
    button:hover { background: white; color: black; }
    .btn-highlight { background: #1ed760; border-color: #1ed760; color: black; }
    .btn-highlight:hover { background: #1fdf64; color: black; }
    .error-msg { color: #ff6b6b; background: rgba(255,0,0,0.1); padding: 10px; border-radius: 5px; }
  `]
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
    this.route.queryParams.subscribe(p => { if (p['verificado']) console.log("Verificado"); });
    this.cargarPrecios();
  }

  cargarPrecios() {
    this.http.get('http://localhost:8080/api/bares/precios').subscribe({
      next: (res: any) => {
        const preciosNorm: any = {};
        for (const key in res) { if (res[key]) preciosNorm[key.toUpperCase().trim()] = res[key]; }
        this.precios = preciosNorm;
        if (this.precios['SUSCRIPCION_MENSUAL']) this.cargando = false;
        else { this.cargando = false; this.errorMensaje = "Error: Datos de precios no encontrados."; }
      },
      error: (e) => { this.cargando = false; this.errorMensaje = "Error de conexión con Backend."; }
    });
  }

  pagar(tipo: string) {
    if (!this.emailUsuario) { alert('Introduce tu email.'); return; }
    this.http.post('http://localhost:8080/api/bares/suscripcion', { email: this.emailUsuario, tipo: tipo }).subscribe({
      next: () => { alert('¡Activado!'); this.router.navigate(['/login']); },
      error: (e) => alert(e.error?.error || 'Error al activar.')
    });
  }
}