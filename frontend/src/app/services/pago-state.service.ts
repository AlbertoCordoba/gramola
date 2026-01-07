/*
 * ======================================================================================
 * RESUMEN
 * ======================================================================================
 * Servicio de Estado (State Management) ligero.
 * Su función es actuar como intermediario temporal para transportar los datos del pago
 * (qué se compra y cuánto cuesta) desde el componente que inicia la compra
 * hasta el componente de la pasarela, sin usar la URL para pasar parámetros.
 * ======================================================================================
 */

import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PagoStateService {
  // Variable privada en memoria para guardar el estado.
  // Al ser un Singleton, los datos persisten mientras no se recargue la página.
  private pagoData: any = null;

  /*
   * SETTER
   * Guarda la información de la transacción pendiente.
   * Se llama justo antes de navegar a '/pasarela' o abrir el modal.
   */
  setPago(datos: { 
    concepto: string, 
    precio: number, 
    tipo: 'CANCION' | 'SUSCRIPCION', 
    payload: any // Datos extra (id de canción, id de bar, etc.)
  }) {
    this.pagoData = datos;
  }

  /*
   * GETTER
   * Recupera los datos para pintarlos en el recibo de la pasarela.
   */
  getPago() {
    return this.pagoData;
  }

  /*
   * LIMPIEZA
   * Es vital limpiar el estado después de un pago (exitoso o cancelado)
   * para evitar que datos antiguos reaparezcan en futuras transacciones.
   */
  clear() {
    this.pagoData = null;
  }
}