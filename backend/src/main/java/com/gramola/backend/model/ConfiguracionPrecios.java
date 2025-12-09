package com.gramola.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;

@Data
@Entity
@Table(name = "configuracion_precios")
public class ConfiguracionPrecios {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // --- CAMBIO IMPORTANTE: Mapeamos a 'clave' en lugar de 'nombre' ---
    @Column(name = "clave", unique = true) 
    private String clave; // Aquí es donde está 'SUSCRIPCION_MENSUAL'

    @Column(name = "valor")
    private BigDecimal valor;
    
    @Column(name = "descripcion")
    private String descripcion;

    @Column(name = "nombre") // Mapeamos 'nombre' también, aunque venga NULL
    private String nombre;
}