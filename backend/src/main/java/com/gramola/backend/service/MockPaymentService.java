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