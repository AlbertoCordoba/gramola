/*
 * ======================================================================================
 * RESUMEN
 * ======================================================================================
 * * ¿QUÉ ES ESTA CLASE?
 * Es el "sobre" que contiene la información necesaria para iniciar sesión.
 *
 * * PUNTOS CLAVE (SEGURIDAD CONTEXTUAL):
 * 1. MÁS QUE USUARIO Y CONTRASEÑA:
 * A diferencia de un login tradicional, este DTO obliga a enviar la ubicación GPS
 * ('lat' y 'lng') junto con las credenciales.
 *
 * 2. GEOLOCALIZACIÓN COMO FACTOR DE SEGURIDAD:
 * Estos campos son críticos. Si el usuario intenta loguearse desde su casa (lejos del bar),
 * el servicio usará estos datos para calcular la distancia y bloquear el acceso.
 * Es una medida anti-fraude para asegurar que la Gramola solo se gestiona presencialmente.
 * ======================================================================================
 */

package com.gramola.backend.dto;

import lombok.Data;

@Data
public class BarLoginDTO {
    
    // Credenciales estándar
    private String email;
    private String password;
    
    // Coordenadas GPS del dispositivo que intenta hacer login.
    // Usamos Double para máxima precisión decimal.
    private Double lat;
    private Double lng;
}