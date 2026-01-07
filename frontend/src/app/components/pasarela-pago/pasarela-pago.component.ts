/*
 * ======================================================================================
 * RESUMEN
 * ======================================================================================
 * * ¿QUÉ ES ESTA CLASE?
 * Es un componente híbrido que simula una pasarela de pago (tipo Stripe).
 * Es "híbrido" porque está diseñado para funcionar en dos contextos:
 * 1. Como página completa: Al pagar una suscripción desde el registro.
 * 2. Como ventana modal (Pop-up): Al pagar una canción desde la Gramola.
 *
 * * PUNTOS CLAVE:
 * 1. REUTILIZACIÓN (@Input / @Output):
 * Usamos el decorador '@Input() isModal' para cambiar su comportamiento visual y de
 * navegación. Si es modal, emite un evento '@Output() close' al terminar. Si es página,
 * usa el Router para navegar. Esto evita duplicar código para el mismo proceso de pago.
 *
 * 2. VALIDACIÓN EN CLIENTE (Lógica de Negocio):
 * No solo validamos que los campos no estén vacíos. Implementamos lógica real:
 * - Formato de tarjeta (espacios cada 4 dígitos).
 * - Fecha de caducidad: Calculamos si la fecha introducida (MM/AA) es anterior a la
 * fecha actual del sistema (new Date()) para rechazar tarjetas caducadas.
 *
 * 3. CONTROL DE FLUJO (PagoStateService):
 * Recuperamos los datos de la transacción (precio, concepto) del servicio de estado
 * compartido, evitando pasar datos sensibles por la URL.
 * ======================================================================================
 */

import { Component, inject, OnInit, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { PagoStateService } from '../../services/pago-state.service';

@Component({
  selector: 'app-pasarela-pago',
  standalone: true,
  imports: [CommonModule, FormsModule], // FormsModule para el Two-Way Binding de los inputs
  templateUrl: './pasarela-pago.component.html',
  styleUrl: './pasarela-pago.component.css'
})
export class PasarelaPagoComponent implements OnInit {
  // --- INYECCIÓN DE DEPENDENCIAS ---
  private pagoState = inject(PagoStateService);
  private http = inject(HttpClient);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef); // Para forzar actualizaciones visuales

  // --- COMUNICACIÓN PADRE-HIJO (Reutilización) ---
  // @Input: Permite al componente padre decirle: "Compórtate como un modal".
  @Input() isModal: boolean = false; 
  // @Output: Permite avisar al padre cuando hemos terminado (para que cierre el modal).
  @Output() close = new EventEmitter<boolean>(); 

  // Datos de la transacción
  datosPago: any;
  
  // Variables de control de interfaz
  simularFallo: boolean = false; // Checkbox para que el tribunal pruebe errores de tarjeta
  procesando: boolean = false;   // Muestra spinner en el botón
  pagoRealizado: boolean = false; // Cambia la vista al "Check verde" de éxito
  
  // Mensajes de error para validación
  errorGeneral: string = '';
  errCard: string = '';
  errDate: string = '';
  errCvv: string = '';

  // Modelo del formulario (Vinculado con [(ngModel)] en el HTML)
  cardName: string = '';
  cardNumber: string = '';
  cardExpiry: string = '';
  cardCvv: string = '';

  ngOnInit() {
    // Recuperamos la información de qué estamos pagando (Suscripción o Canción)
    this.datosPago = this.pagoState.getPago();
    
    // MEDIDA DE SEGURIDAD:
    // Si el usuario recarga la página (F5), el servicio en memoria se borra.
    // Si no hay datos, lo expulsamos para evitar errores.
    if (!this.datosPago) {
      this.cancelar();
    }
  }

  // --- LÓGICA DE VALIDACIÓN (UX) ---

  // Formatea la tarjeta en grupos de 4 (0000 0000...)
  validateCardNumber(event: any) {
    const input = event.target.value;
    
    // Validación de caracteres
    if (/[a-zA-Z]/.test(input)) {
      this.errCard = '❌ Solo números';
    } else {
      this.errCard = '';
    }
    
    // Limpieza y formateo visual
    const clean = input.replace(/\D/g, '').substring(0, 16); // Solo 16 dígitos
    // Regex mágico: Inserta un espacio cada 4 dígitos
    this.cardNumber = clean.replace(/(\d{4})(?=\d)/g, '$1 ');
  }

  // Valida y formatea la fecha (MM/AA)
  validateExpiry(event: any) {
    const input = event.target.value;
    
    if (/[a-zA-Z]/.test(input)) {
      this.errDate = '❌ Solo números';
    } 

    // Máscara de entrada automática: Añade la barra '/'
    let clean = input.replace(/\D/g, '');
    if (clean.length > 4) clean = clean.substring(0, 4);

    if (clean.length >= 2) {
      this.cardExpiry = clean.substring(0, 2) + '/' + clean.substring(2);
    } else {
      this.cardExpiry = clean;
    }

    // Comprobación lógica (Fecha en el pasado)
    this.checkFechaValida();
  }

  // Algoritmo para verificar si la tarjeta ha caducado
  checkFechaValida(): boolean {
    this.errDate = ''; // Resetear error
    if (this.cardExpiry.length === 5) {
      const parts = this.cardExpiry.split('/');
      const mes = parseInt(parts[0], 10);
      const anio = parseInt(parts[1], 10); // 2 dígitos (ej: 25 para 2025)

      // Validación de mes
      if (mes < 1 || mes > 12) {
        this.errDate = 'Mes inválido';
        return false;
      }

      // Obtener fecha actual
      const fechaActual = new Date();
      const anioActual = parseInt(fechaActual.getFullYear().toString().slice(-2));
      const mesActual = fechaActual.getMonth() + 1; // getMonth() devuelve 0-11

      // Comparación temporal
      if (anio < anioActual) {
        this.errDate = 'Tarjeta caducada'; // Año pasado
        return false;
      } else if (anio === anioActual && mes < mesActual) {
        this.errDate = 'Tarjeta caducada'; // Mismo año, mes pasado
        return false;
      }
      return true;
    }
    return false;
  }

  validateCvv(event: any) {
    const input = event.target.value;
    if (/[a-zA-Z]/.test(input)) this.errCvv = '❌ Solo números';
    else this.errCvv = '';
    
    // Limita a 3 dígitos
    let clean = input.replace(/\D/g, '').substring(0, 3);
    this.cardCvv = clean;
  }

  // --- PROCESAMIENTO DEL PAGO ---

  confirmarPago() {
    // 1. Barrera de validación final antes de llamar al servidor
    if (!this.checkFechaValida()) {
        if (!this.errDate) this.errDate = 'Fecha incompleta';
        return;
    }

    if (this.errCard || this.errDate || this.errCvv) {
      this.errorGeneral = 'Corrige los errores antes de pagar.';
      return;
    }
    
    // Validar longitudes exactas (16 dígitos + 3 CVV)
    if (this.cardNumber.replace(/\s/g, '').length !== 16) {
        this.errCard = 'Faltan números'; return;
    }
    if (this.cardCvv.length !== 3) {
        this.errCvv = 'Incompleto'; return;
    }

    this.procesando = true;
    this.errorGeneral = '';

    // Preparamos el JSON para el Backend
    // 'simularFallo' permite al tribunal probar qué pasa si el banco rechaza la tarjeta.
    const finalPayload = { 
      ...this.datosPago.payload, 
      simularError: this.simularFallo 
    };
    
    // 2. Selección dinámica del Endpoint según el tipo de compra
    let url = '';
    if (this.datosPago.tipo === 'CANCION') {
      url = 'http://localhost:8080/api/gramola/cola/add';
    } else if (this.datosPago.tipo === 'SUSCRIPCION') {
      url = 'http://localhost:8080/api/bares/suscripcion';
    }

    // 3. Petición HTTP
    this.http.post(url, finalPayload).subscribe({
      next: (res) => {
        this.procesando = false;
        
        // UX: Mostramos pantalla de éxito (check verde animado) en lugar del formulario
        this.pagoRealizado = true;
        this.cdr.detectChanges(); 

        // 4. Cierre automático retardado
        // Esperamos 2.5s para que el usuario vea la confirmación visual
        setTimeout(() => {
          if (this.isModal) {
            this.close.emit(true); // Avisamos al componente padre (Gramola)
          } else {
            // Navegación normal
            if (this.datosPago.tipo === 'CANCION') {
                this.router.navigate(['/gramola']);
            } else {
                this.router.navigate(['/login']); // Tras pagar suscripción, a loguearse
            }
          }
          this.pagoState.clear(); // Limpiamos datos sensibles de memoria
        }, 2500); 
      },
      error: (err) => {
        this.procesando = false;
        // Mostramos el error que viene del Backend ("Fondos insuficientes", etc.)
        this.errorGeneral = err.error?.error || 'Error procesando el pago.';
        this.cdr.detectChanges();
      }
    });
  }

  cancelar() {
    this.pagoState.clear();
    // Comportamiento condicional:
    if (this.isModal) {
      this.close.emit(false); // Cierra el pop-up sin hacer nada
    } else {
      window.history.back(); // Vuelve a la página anterior del navegador
    }
  }
}