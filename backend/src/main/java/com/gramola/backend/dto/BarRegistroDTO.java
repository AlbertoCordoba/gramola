/*
 * ======================================================================================
 * RESUMEN
 * ======================================================================================
 * * ¿QUÉ ES ESTA CLASE?
 * 'BarRegistroDTO' es un objeto de transferencia de datos (DTO). Su única función es
 * agrupar los datos que vienen del formulario de registro de Angular para transportarlos
 * hasta el Controlador de forma segura y estructurada.
 *
 * * PUNTOS CLAVE:
 * 1. DESACOPLAMIENTO:
 * No usamos la entidad 'Bar' directamente porque en el registro recibimos campos que
 * no existen en la base de datos (como 'confirmPassword' o 'firmaBase64' en formato String).
 * El DTO nos permite recibir esa información "cruda", procesarla y luego pasarla limpia
 * a la entidad.
 *
 * 2. GESTIÓN DE FIRMA DIGITAL:
 * Recibimos la firma como un String en formato Base64 (directamente desde el Canvas HTML).
 * Más tarde, el servicio se encargará de decodificar este String a un array de bytes
 * para guardarlo eficientemente.
 *
 * 3. VALIDACIÓN DE PASSWORD:
 * Incluimos 'confirmPassword' para poder validar en el servidor que el usuario no se
 * equivocó al escribir su clave, una regla de negocio básica de seguridad.
 * ======================================================================================
 */

package com.gramola.backend.dto;

import lombok.Data;

/*
 * @Data (Lombok):
 * Genera getters y setters automáticamente. Un DTO debe ser una estructura de datos
 * pura, sin lógica, por lo que Lombok es perfecto aquí para evitar código basura.
 */
@Data
public class BarRegistroDTO {
    
    // Datos básicos de identidad
    private String nombre;
    private String email;
    
    // Seguridad
    private String password;
    private String confirmPassword; // Campo auxiliar, no se guarda en BD, solo valida.
    
    // Ubicación GPS (para la configuración inicial del local)
    private Double latitud;
    private Double longitud;
    
    // Firma Digital
    // Llega como "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
    // El servicio la limpiará y convertirá a binario.
    private String firmaBase64;
}