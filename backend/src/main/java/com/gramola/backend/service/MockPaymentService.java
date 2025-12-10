package com.gramola.backend.service;

import org.springframework.stereotype.Service;

@Service
public class MockPaymentService {

    // Simula la conexión con una pasarela real (Visa/Mastercard/Stripe)
    public void procesarPago(boolean simularError) throws Exception {
        // Simulamos el tiempo que tarda el banco en responder (2 segundos)
        try { 
            Thread.sleep(2000); 
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        if (simularError) {
            throw new Exception("Operación denegada: Fondos insuficientes o tarjeta rechazada.");
        }
        // Si no hay error, el método termina silenciosamente (pago aprobado)
    }
}