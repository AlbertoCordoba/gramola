import { Component, inject, OnInit, Input, Output, EventEmitter, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { PagoStateService } from '../../services/pago-state.service';

declare var Stripe: any;

@Component({
  selector: 'app-pasarela-pago',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pasarela-pago.component.html',
  styleUrl: './pasarela-pago.component.css'
})
export class PasarelaPagoComponent implements OnInit, OnDestroy {
  
  private pagoState = inject(PagoStateService);
  private http = inject(HttpClient);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  @Input() isModal: boolean = false; 
  @Output() close = new EventEmitter<boolean>(); 

  datosPago: any;
  stripe: any;
  elements: any;
  card: any; 
  clientSecret: string = '';
  
  procesando: boolean = false;
  stripeReady: boolean = false; 
  errorGeneral: string = '';
  mensajeExito: string = '';

  stripePublicKey = 'pk_test_51Sn1eQRvZ6y98AypGTwUQsWGR4QVneAgT3sb3hKRDL0FUV8XWfG9HKJEAhIg4ppfy83nGiAarwVFifsmUqnX9HTI00O9Hbx5bq';

  ngOnInit() {
    this.datosPago = this.pagoState.getPago();
    if (!this.datosPago) {
      this.cancelar();
      return;
    }

    if (typeof Stripe !== 'undefined') {
      this.stripe = Stripe(this.stripePublicKey);
      this.obtenerIntencionDePago();
    }
  }

  ngOnDestroy() {
    if (this.card) this.card.destroy();
  }

  obtenerIntencionDePago() {
    // BUSCAMOS EL EMAIL REAL:
    // 1. Del payload del pago (si viene de registro o canción)
    // 2. Del usuario logueado en el bar
    const storageUser = JSON.parse(localStorage.getItem('usuarioBar') || '{}');
    const emailReal = this.datosPago.payload?.email || storageUser.email || 'error@gramola.com';
    const tipo = this.datosPago.tipo; 

    this.http.get<any>(`http://localhost:8080/payments/prepay?email=${emailReal}&tipo=${tipo}`)
      .subscribe({
        next: (res) => {
          try {
            // El backend ahora envía un JSON limpio
            const stripeData = JSON.parse(res.data);
            this.clientSecret = stripeData.client_secret;
            this.montarFormularioStripe();
          } catch (e) {
            this.errorGeneral = 'Error procesando la respuesta de pagos.';
          }
        },
        error: () => this.errorGeneral = 'Error conectando con el servidor de pagos.'
      });
  }

  montarFormularioStripe() {
    this.elements = this.stripe.elements();
    
    const style = {
      base: {
        color: '#ffffff',
        fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
        fontSize: '16px',
        '::placeholder': { color: '#aab7c4' }
      }
    };

    this.card = this.elements.create('card', { 
      style: style,
      hidePostalCode: true // Requisito 2.4 del doc
    });
    this.card.mount('#card-element');
    
    this.card.on('change', (event: any) => {
      this.stripeReady = event.complete;
      this.cdr.detectChanges(); 
    });
  }

  async confirmarPago() {
    this.procesando = true;
    const result = await this.stripe.confirmCardPayment(this.clientSecret, {
      payment_method: { card: this.card }
    });

    if (result.error) {
      this.errorGeneral = result.error.message;
      this.procesando = false;
      this.cdr.detectChanges();
    } else if (result.paymentIntent.status === 'succeeded') {
      this.mensajeExito = '¡Pago realizado!';
      this.cdr.detectChanges();
      this.finalizarOperacionEnBackend(result.paymentIntent.id);
    }
  }

  finalizarOperacionEnBackend(transactionId: string) {
    let url = this.datosPago.tipo === 'CANCION' 
              ? 'http://localhost:8080/api/gramola/cola/add' 
              : 'http://localhost:8080/api/bares/suscripcion';

    const finalPayload = { ...this.datosPago.payload, stripeTransactionId: transactionId };

    this.http.post(url, finalPayload).subscribe({
      next: () => setTimeout(() => this.cerrarYRedirigir(), 1500),
      error: () => {
        this.errorGeneral = 'Error activando el servicio.';
        this.procesando = false;
      }
    });
  }

  cerrarYRedirigir() {
    this.pagoState.clear();
    if (this.isModal) this.close.emit(true);
    else {
      this.datosPago.tipo === 'CANCION' 
        ? this.router.navigate(['/gramola']) 
        : this.router.navigate(['/login']); 
    }
  }

  cancelar() {
    this.pagoState.clear();
    if (this.isModal) this.close.emit(false);
    else window.history.back();
  }
}