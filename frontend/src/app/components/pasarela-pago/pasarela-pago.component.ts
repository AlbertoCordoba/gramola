import { Component, inject, OnInit, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { PagoStateService } from '../../services/pago-state.service';

@Component({
  selector: 'app-pasarela-pago',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pasarela-pago.component.html',
  styleUrl: './pasarela-pago.component.css'
})
export class PasarelaPagoComponent implements OnInit {
  private pagoState = inject(PagoStateService);
  private http = inject(HttpClient);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef); // Importante para actualizar la vista

  @Input() isModal: boolean = false; 
  @Output() close = new EventEmitter<boolean>(); 

  datosPago: any;
  simularFallo: boolean = false;
  procesando: boolean = false;
  
  // Variable para controlar qué pantalla se ve (Formulario vs Éxito)
  pagoRealizado: boolean = false;
  
  // Mensajes de error
  errorGeneral: string = '';
  errCard: string = '';
  errDate: string = '';
  errCvv: string = '';

  // Modelo del formulario
  cardName: string = '';
  cardNumber: string = '';
  cardExpiry: string = '';
  cardCvv: string = '';

  ngOnInit() {
    this.datosPago = this.pagoState.getPago();
    // Si no hay datos de pago (por ej. recarga de página), volvemos atrás
    if (!this.datosPago) {
      this.cancelar();
    }
  }

  // --- VALIDACIONES ---

  validateCardNumber(event: any) {
    const input = event.target.value;
    // Solo permitir números
    if (/[a-zA-Z]/.test(input)) {
      this.errCard = '❌ Solo números';
    } else {
      this.errCard = '';
    }
    // Formato con espacios
    const clean = input.replace(/\D/g, '').substring(0, 16);
    this.cardNumber = clean.replace(/(\d{4})(?=\d)/g, '$1 ');
  }

  validateExpiry(event: any) {
    const input = event.target.value;
    
    // Solo permitir números
    if (/[a-zA-Z]/.test(input)) {
      this.errDate = '❌ Solo números';
    } 

    // Formato MM/AA
    let clean = input.replace(/\D/g, '');
    if (clean.length > 4) clean = clean.substring(0, 4);

    if (clean.length >= 2) {
      this.cardExpiry = clean.substring(0, 2) + '/' + clean.substring(2);
    } else {
      this.cardExpiry = clean;
    }

    // Validar lógica de fecha (Pasado)
    this.checkFechaValida();
  }

  checkFechaValida(): boolean {
    this.errDate = ''; // Resetear error
    if (this.cardExpiry.length === 5) {
      const parts = this.cardExpiry.split('/');
      const mes = parseInt(parts[0], 10);
      const anio = parseInt(parts[1], 10); // 2 dígitos

      if (mes < 1 || mes > 12) {
        this.errDate = 'Mes inválido';
        return false;
      }

      const fechaActual = new Date();
      // Año actual en 2 dígitos
      const anioActual = parseInt(fechaActual.getFullYear().toString().slice(-2));
      const mesActual = fechaActual.getMonth() + 1;

      // Comprobar si es pasado
      if (anio < anioActual) {
        this.errDate = 'Tarjeta caducada';
        return false;
      } else if (anio === anioActual && mes < mesActual) {
        this.errDate = 'Tarjeta caducada';
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
    
    let clean = input.replace(/\D/g, '').substring(0, 3);
    this.cardCvv = clean;
  }

  // --- ACCIONES ---

  confirmarPago() {
    // Validar fecha antes de enviar
    if (!this.checkFechaValida()) {
        if (!this.errDate) this.errDate = 'Fecha incompleta';
        return;
    }

    if (this.errCard || this.errDate || this.errCvv) {
      this.errorGeneral = 'Corrige los errores antes de pagar.';
      return;
    }
    
    // Validar longitud exacta
    if (this.cardNumber.replace(/\s/g, '').length !== 16) {
        this.errCard = 'Faltan números'; return;
    }
    if (this.cardCvv.length !== 3) {
        this.errCvv = 'Incompleto'; return;
    }

    this.procesando = true;
    this.errorGeneral = '';

    const finalPayload = { 
      ...this.datosPago.payload, 
      simularError: this.simularFallo 
    };
    
    let url = '';
    if (this.datosPago.tipo === 'CANCION') {
      url = 'http://localhost:8080/api/gramola/cola/add';
    } else if (this.datosPago.tipo === 'SUSCRIPCION') {
      url = 'http://localhost:8080/api/bares/suscripcion';
    }

    this.http.post(url, finalPayload).subscribe({
      next: (res) => {
        this.procesando = false;
        
        // 1. CAMBIAR LA PANTALLA A ÉXITO
        this.pagoRealizado = true;
        this.cdr.detectChanges(); // Forzar actualización de vista

        // 2. ESPERAR Y CERRAR
        setTimeout(() => {
          if (this.isModal) {
            this.close.emit(true);
          } else {
            if (this.datosPago.tipo === 'CANCION') {
                this.router.navigate(['/gramola']);
            } else {
                this.router.navigate(['/login']);
            }
          }
          this.pagoState.clear();
        }, 2500); // 2.5 segundos para ver la animación
      },
      error: (err) => {
        this.procesando = false;
        this.errorGeneral = err.error?.error || 'Error procesando el pago.';
        this.cdr.detectChanges();
      }
    });
  }

  cancelar() {
    this.pagoState.clear();
    if (this.isModal) {
      this.close.emit(false);
    } else {
      window.history.back();
    }
  }
}