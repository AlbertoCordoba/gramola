import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PagoStateService {
  private pagoData: any = null;

  setPago(datos: { 
    concepto: string, 
    precio: number, 
    tipo: 'CANCION' | 'SUSCRIPCION', 
    payload: any 
  }) {
    this.pagoData = datos;
  }

  getPago() {
    return this.pagoData;
  }

  clear() {
    this.pagoData = null;
  }
}