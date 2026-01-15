package com.gramola.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "pagos")
public class Pagos {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // --- ORIGEN DEL INGRESO ---
    // El bar que recibe el beneficio o que paga la suscripción.
    @Column(name = "bar_id")
    private Long barId;

    // --- DETALLE DE PRODUCTO ---
    // Si el pago es de tipo "CANCION", aquí guardamos el ID de la 'CancionSolicitada'.
    // Si el pago es de tipo "SUSCRIPCION", este campo se queda NULL.
    @Column(name = "cancion_id")
    private Long cancionId;

    // --- CONCEPTO ---
    // Texto descriptivo de la operación (ej: "PAGO_CANCION", "Suscripción: MENSUAL").
    private String concepto;

    // --- IMPORTE ---
    // Nuevamente, BigDecimal para precisión monetaria absoluta.
    private BigDecimal monto;

    // --- FECHA ---
    // Momento exacto en que la pasarela de pago confirmó la operación.
    @Column(name = "fecha_pago")
    private LocalDateTime fechaPago;
}