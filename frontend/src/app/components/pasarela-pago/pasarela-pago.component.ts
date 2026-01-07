import { Component, inject, OnInit, Input, Output, EventEmitter, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { PagoStateService } from '../../services/pago-state.service';

// Declaramos la variable global de Stripe que viene del script del index.html
declare var Stripe: any;

@Component({
  selector: 'app-pasarela-pago',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pasarela-pago.component.html',
  styleUrl: './pasarela-pago.component.css'
})
export class PasarelaPagoComponent implements OnInit, OnDestroy {
  
  // --- INYECCIONES ---
  private pagoState = inject(PagoStateService);
  private http = inject(HttpClient);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef); // Fundamental para actualizar el botón

  // --- COMUNICACIÓN (MODAL) ---
  @Input() isModal: boolean = false; 
  @Output() close = new EventEmitter<boolean>(); 

  // --- DATOS ---
  datosPago: any;
  
  // --- VARIABLES STRIPE ---
  stripe: any;
  elements: any;
  card: any; 
  clientSecret: string = '';
  
  // --- ESTADO UI ---
  procesando: boolean = false;
  stripeReady: boolean = false; // Controla si el botón está gris o verde
  errorGeneral: string = '';
  mensajeExito: string = '';

  // TU CLAVE PÚBLICA (La que me pasaste)
  stripePublicKey = 'pk_test_51Sn1eQRvZ6y98AypGTwUQsWGR4QVneAgT3sb3hKRDL0FUV8XWfG9HKJEAhIg4ppfy83nGiAarwVFifsmUqnX9HTI00O9Hbx5bq';

  ngOnInit() {
    this.datosPago = this.pagoState.getPago();
    
    // Seguridad: Si no hay datos (F5), volvemos atrás
    if (!this.datosPago) {
      this.cancelar();
      return;
    }

    // 1. Inicializar Stripe
    if (typeof Stripe !== 'undefined') {
      this.stripe = Stripe(this.stripePublicKey);
      // 2. Pedir permiso al backend (Client Secret)
      this.obtenerIntencionDePago();
    } else {
      this.errorGeneral = "Error crítico: Stripe no ha cargado. Revisa tu index.html.";
    }
  }

  ngOnDestroy() {
    // Limpieza al salir para no dejar basura en el DOM
    if (this.card) {
      this.card.destroy();
    }
  }

  obtenerIntencionDePago() {
    const email = this.datosPago.payload.email || 'usuario_anonimo@gramola.com';

    this.http.get<any>(`http://localhost:8080/payments/prepay?email=${email}`)
      .subscribe({
        next: (res) => {
          try {
            // El backend devuelve un objeto StripeTransaction, el JSON real está dentro de 'data'
            const stripeData = JSON.parse(res.data);
            this.clientSecret = stripeData.client_secret;
            
            // Ya tenemos la llave, montamos el formulario
            this.montarFormularioStripe();
          } catch (e) {
            this.errorGeneral = 'Error leyendo la respuesta del servidor de pagos.';
          }
        },
        error: (err) => {
          console.error(err);
          this.errorGeneral = 'No se pudo conectar con el servidor (Backend).';
        }
      });
  }

  montarFormularioStripe() {
    this.elements = this.stripe.elements();
    
    // Estilos del IFRAME interno de Stripe
    const style = {
      base: {
        color: '#32325d',
        fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
        fontSmoothing: 'antialiased',
        fontSize: '16px',
        '::placeholder': { color: '#aab7c4' }
      },
      invalid: {
        color: '#fa755a',
        iconColor: '#fa755a'
      }
    };

    // Crear y montar el input
    this.card = this.elements.create('card', { style: style });
    this.card.mount('#card-element');
    
    // --- ESCUCHA DE EVENTOS (Aquí estaba el problema) ---
    this.card.on('change', (event: any) => {
      const displayError = document.getElementById('card-errors');
      
      // 1. Mostrar errores de validación (ej: "Falta el año")
      if (event.error) {
        displayError!.textContent = event.error.message;
      } else {
        displayError!.textContent = '';
      }

      // 2. ACTIVAR EL BOTÓN
      // 'event.complete' es true SOLO si número, fecha y CVC son válidos.
      this.stripeReady = event.complete;
      
      // 3. ¡IMPORTANTE! Forzar a Angular a revisar la vista para habilitar el botón
      this.cdr.detectChanges(); 
    });
  }

  async confirmarPago() {
    this.procesando = true;
    this.errorGeneral = '';

    // Enviar pago a Stripe
    const result = await this.stripe.confirmCardPayment(this.clientSecret, {
      payment_method: {
        card: this.card,
        billing_details: {
          email: this.datosPago.payload.email
        }
      }
    });

    if (result.error) {
      // Fallo (Fondos insuficientes, tarjeta rechazada...)
      this.errorGeneral = result.error.message;
      this.procesando = false;
      this.cdr.detectChanges();
    } else {
      // Éxito
      if (result.paymentIntent.status === 'succeeded') {
        this.mensajeExito = '¡Pago realizado correctamente!';
        this.cdr.detectChanges();
        // Avisar a nuestro backend para activar el servicio/canción
        this.finalizarOperacionEnBackend(result.paymentIntent.id);
      }
    }
  }

  finalizarOperacionEnBackend(transactionId: string) {
    let url = '';
    
    if (this.datosPago.tipo === 'CANCION') {
      url = 'http://localhost:8080/api/gramola/cola/add';
    } else if (this.datosPago.tipo === 'SUSCRIPCION') {
      url = 'http://localhost:8080/api/bares/suscripcion';
    }

    const finalPayload = { 
      ...this.datosPago.payload, 
      stripeTransactionId: transactionId 
    };

    this.http.post(url, finalPayload).subscribe({
      next: () => {
        // Retardo para que el usuario vea el check verde
        setTimeout(() => this.cerrarYRedirigir(), 2000);
      },
      error: (err) => {
        this.errorGeneral = 'Pago cobrado, pero error activando el servicio. Contacta soporte.';
        this.procesando = false;
      }
    });
  }

  cerrarYRedirigir() {
    this.pagoState.clear();
    
    if (this.isModal) {
      this.close.emit(true);
    } else {
      if (this.datosPago.tipo === 'CANCION') {
          this.router.navigate(['/gramola']);
      } else {
          this.router.navigate(['/login']); 
      }
    }
  }

  cancelar() {
    this.pagoState.clear();
    if (this.isModal) this.close.emit(false);
    else window.history.back();
  }
}