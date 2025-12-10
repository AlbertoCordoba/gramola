import { Component, inject, OnInit, Input, Output, EventEmitter } from '@angular/core';
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

  @Input() isModal: boolean = false; 
  @Output() close = new EventEmitter<boolean>(); 

  datosPago: any;
  simularFallo: boolean = false;
  procesando: boolean = false;
  
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
    if (!this.datosPago) {
      this.cancelar();
    }
  }

  // --- VALIDACIONES EN TIEMPO REAL ---

  validateCardNumber(event: any) {
    const input = event.target.value;
    
    // 1. Detectar letras
    if (/[a-zA-Z]/.test(input)) {
      this.errCard = '❌ Solo números permitidos';
      return; 
    } else {
      this.errCard = '';
    }

    // 2. Limpiar y limitar a 16 dígitos
    const clean = input.replace(/\D/g, '');
    const truncated = clean.substring(0, 16); // MÁXIMO 16 DÍGITOS

    // 3. Formatear (Espacios cada 4 números)
    this.cardNumber = truncated.replace(/(\d{4})(?=\d)/g, '$1 ');
  }

  validateExpiry(event: any) {
    const input = event.target.value;

    if (/[a-zA-Z]/.test(input)) {
      this.errDate = '❌ Solo números';
      return;
    } else {
      this.errDate = '';
    }

    // Formato MM/AA automático
    let clean = input.replace(/\D/g, '');
    if (clean.length > 4) clean = clean.substring(0, 4);

    if (clean.length >= 2) {
      this.cardExpiry = clean.substring(0, 2) + '/' + clean.substring(2);
    } else {
      this.cardExpiry = clean;
    }
  }

  validateCvv(event: any) {
    const input = event.target.value;

    if (/[a-zA-Z]/.test(input)) {
      this.errCvv = '❌ Solo números';
      return;
    } else {
      this.errCvv = '';
    }

    // Limitar a 3 dígitos (Estricto)
    let clean = input.replace(/\D/g, '');
    if (clean.length > 3) clean = clean.substring(0, 3);
    this.cardCvv = clean;
  }

  // ---------------------------

  confirmarPago() {
    // Validaciones finales antes de enviar
    if (this.errCard || this.errDate || this.errCvv) {
      this.errorGeneral = 'Por favor, corrige los errores.';
      return;
    }

    // Comprobamos longitudes exactas
    if (this.cardNumber.replace(/\s/g, '').length !== 16) {
      this.errCard = 'Deben ser 16 números';
      return;
    }
    if (this.cardExpiry.length !== 5) { // 2 mes + 1 barra + 2 año
      this.errDate = 'Incompleto (MM/AA)';
      return;
    }
    if (this.cardCvv.length !== 3) {
      this.errCvv = 'Deben ser 3 dígitos';
      return;
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
        setTimeout(() => {
          this.procesando = false;
          alert('✅ Pago realizado con éxito.');
          
          if (this.isModal) {
            this.close.emit(true); // Cierra el modal sin recargar página
          } else {
            if (this.datosPago.tipo === 'CANCION') {
                this.router.navigate(['/gramola']);
            } else {
                this.router.navigate(['/login']);
            }
          }
          this.pagoState.clear();
        }, 1500);
      },
      error: (err) => {
        setTimeout(() => {
          this.procesando = false;
          this.errorGeneral = err.error?.error || 'Error procesando el pago.';
        }, 1000);
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