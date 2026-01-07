package com.gramola.backend.model;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "stripe_transaction")
public class StripeTransaction {

    @Id
    private String id; // El ID de la transacción (ej: "pi_3M...")

    @Lob
    @Column(columnDefinition = "TEXT") 
    private String data; // Guardamos el JSON completo de Stripe

    private String email; 
}