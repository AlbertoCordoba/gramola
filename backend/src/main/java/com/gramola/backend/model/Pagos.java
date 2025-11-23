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

    @Column(name = "bar_id")
    private Long barId;

    @Column(name = "cancion_id")
    private Long cancionId;

    private String concepto;
    private BigDecimal monto;

    @Column(name = "fecha_pago")
    private LocalDateTime fechaPago;
}