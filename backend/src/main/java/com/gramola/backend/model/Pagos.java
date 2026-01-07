/*
 * ======================================================================================
 * RESUMEN
 * ======================================================================================
 * * ¿QUÉ ES ESTA CLASE?
 * La entidad 'Pagos' actúa como el libro de contabilidad (Ledger) de la aplicación.
 * Registra cada transacción económica que ocurre en el sistema de forma inmutable.
 *
 * * PUNTOS CLAVE:
 * 1. AUDITORÍA FINANCIERA:
 * Cada vez que alguien paga (ya sea un Bar pagando su suscripción o un Cliente
 * pagando una canción), se genera un registro aquí. Esto permite sacar reportes de
 * ingresos y facturación.
 *
 * 2. TRAZABILIDAD:
 * - 'barId': Sabemos quién ingresó el dinero (el local).
 * - 'cancionId': Si el pago fue por una canción, guardamos su ID para saber
 * exactamente qué canción generó ese ingreso (opcional, puede ser null si es suscripción).
 *
 * 3. CONSISTENCIA:
 * Al igual que en la configuración, usamos BigDecimal para evitar errores de céntimos
 * y LocalDateTime para saber el momento exacto de la transacción.
 * ======================================================================================
 */

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