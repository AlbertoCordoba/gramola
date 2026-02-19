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
  // MÉTODO DE INICIO: Recupera los datos del pago (precio y concepto) del servicio de estado.
  // Inicializa el objeto global 'Stripe' con tu clave pública de pruebas.
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
  // CICLO DE VIDA (Final): Se ejecuta automáticamente al destruir el componente.
  // Es vital para eliminar el objeto 'card' de Stripe de la memoria y evitar errores si el usuario vuelve a entrar.
  ngOnDestroy() {
    if (this.card) this.card.destroy();
  }
  // MÉTODO TÉCNICO: Solicita al Backend una 'Intención de Pago'. 
  // Recibe el 'clientSecret', que es la llave necesaria para autorizar el cobro sin ver la tarjeta.
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
  // MÉTODO DE INTERFAZ: Crea y monta el "Card Element" de Stripe en el HTML. 
  // Esto genera un formulario seguro que captura la tarjeta sin que los datos toquen nuestro servidor.
  montarFormularioStripe() {
    this.elements = this.stripe.elements();
    
    const style = {
      base: {
        color: '#070606ff',
        fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
        fontSize: '16px',
        '::placeholder': { color: '#090909ff' }
      }
    };

    this.card = this.elements.create('card', { 
      style: style,
      hidePostalCode: true
    });
    this.card.mount('#card-element');
    
    this.card.on('change', (event: any) => {
      this.stripeReady = event.complete;
      this.cdr.detectChanges(); 
    });
  }
  // MÉTODO DE ACCIÓN: Envía la información de la tarjeta directamente a los servidores de Stripe.
  // Si el banco aprueba la operación, obtenemos un 'paymentIntent.id' exitoso.
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
  // MÉTODO DE CIERRE: Una vez que Stripe confirma el dinero, avisamos a nuestro Backend (Java) 
  // para que registre la canción en la cola o active la suscripción del bar.
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
  // MÉTODO DE CIERRE: Limpia el servicio de estado y redirige al usuario según el éxito del pago.
  // Si es una canción, vuelve a la Gramola; si es una suscripción, lo manda al Login para entrar ya activo.
  cerrarYRedirigir() {
    this.pagoState.clear();
    if (this.isModal) this.close.emit(true);
    else {
      this.datosPago.tipo === 'CANCION' 
        ? this.router.navigate(['/gramola']) 
        : this.router.navigate(['/login']); 
    }
  }
  // MÉTODO DE SALIDA: Se ejecuta si el usuario decide no pagar. 
  // Limpia los datos temporales en memoria y vuelve a la pantalla anterior
  cancelar() {
    this.pagoState.clear();
    if (this.isModal) this.close.emit(false);
    else window.history.back();
  }
}