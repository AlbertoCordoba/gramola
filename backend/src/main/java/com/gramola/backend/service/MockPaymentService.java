/*
 * ======================================================================================
 * RESUMEN
 * ======================================================================================
 * * ¿QUÉ ES ESTA CLASE?
 * 'MockPaymentService' es un simulador de pasarela de pagos (como Stripe o PayPal).
 * En un entorno real de producción, aquí conectaríamos con la API del banco.
 *
 * * PUNTOS CLAVE:
 * 1. LATENCIA ARTIFICIAL (Thread.sleep):
 * Los pagos reales nunca son instantáneos. Usamos 'Thread.sleep(2000)' para simular
 * los 2 segundos que tarda el banco en responder. Esto nos permite probar la
 * "experiencia de usuario" de espera (spinners de carga) en el Frontend.
 *
 * 2. SIMULACIÓN DE ERRORES (Testing):
 * Aceptamos un parámetro 'simularError'. Esto es vital para el QA (Quality Assurance),
 * ya que nos permite probar qué pasa si el usuario no tiene fondos o la tarjeta es
 * rechazada, sin tener que usar tarjetas de crédito reales erróneas.
 * ======================================================================================
 */

package com.gramola.backend.service;

import org.springframework.stereotype.Service;

@Service
public class MockPaymentService {

    // Simula la conexión con una pasarela real (Visa/Mastercard/Stripe)
    public void procesarPago(boolean simularError) throws Exception {
        // 1. SIMULACIÓN DE LATENCIA DE RED
        // Simulamos el tiempo que tarda el banco en responder (2 segundos)
        try { 
            Thread.sleep(2000); 
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        // 2. SIMULACIÓN DE RESPUESTA DEL BANCO
        if (simularError) {
            // Si el frontend pidió probar un fallo, lanzamos excepción.
            // Esto provocará un rollback en @Transactional del servicio que lo llamó.
            throw new Exception("Operación denegada: Fondos insuficientes o tarjeta rechazada.");
        }
        // Si no hay error, el método termina silenciosamente (pago aprobado)
    }
}