/*
 * ======================================================================================
 * RESUMEN
 * ======================================================================================
 * * ¿QUÉ ES ESTA CLASE?
 * Esta entidad representa la configuración dinámica de la plataforma.
 * Su objetivo es evitar el "Hardcoding" (escribir valores fijos en el código Java).
 *
 * * PUNTOS CLAVE:
 * 1. FLEXIBILIDAD:
 * Si mañana queremos subir el precio de la canción de 0.50€ a 1.00€, o cambiar el
 * precio de la suscripción, NO tenemos que tocar el código ni recompilar el servidor.
 * Simplemente cambiamos el valor en esta tabla de la base de datos y se aplica al instante.
 *
 * 2. CLAVE ÚNICA:
 * Usamos el campo 'clave' (ej: "PRECIO_CANCION", "SUSCRIPCION_MENSUAL") como
 * identificador único para buscar estos valores desde el servicio.
 * ======================================================================================
 */

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

    // --- IDENTIFICADOR DE CONFIGURACIÓN ---
    // Esta es la "llave" para buscar el precio.
    // Ejemplos de valores reales en BD: "PRECIO_CANCION", "SUSCRIPCION_MENSUAL".
    // 'unique = true' garantiza que no haya ambigüedad.
    @Column(name = "clave", unique = true)
    private String clave;

    // --- VALOR MONETARIO ---
    // Usamos BigDecimal en lugar de Double para dinero.
    // NOTA DEFENSA: "En sistemas financieros, 'Double' puede tener errores de redondeo
    // (coma flotante). BigDecimal es la forma correcta y precisa de manejar divisas en Java."
    @Column(name = "valor")
    private BigDecimal valor;

    // --- METADATOS ---
    // Texto explicativo para el administrador de la BD (ej: "Coste por canción unitaria").
    @Column(name = "descripcion")
    private String descripcion;

    // Nombre legible para mostrar en el frontend si fuera necesario.
    @Column(name = "nombre")
    private String nombre;
}