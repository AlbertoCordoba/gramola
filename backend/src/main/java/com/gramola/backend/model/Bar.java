/*
 * ======================================================================================
 * RESUMEN
 * ======================================================================================
 * * ¿QUÉ ES ESTA CLASE?
 * La clase 'Bar' es el corazón de mi modelo de datos. No representa solo a un usuario,
 * sino a la ENTIDAD DE NEGOCIO completa. Es el punto central donde convergen cuatro
 * sistemas críticos de la aplicación:
 *
 * 1. IDENTIDAD Y ACCESO:
 * Gestiona quién es el dueño (email/password) y si tiene permiso para operar
 * mediante el campo 'activo', que actúa como interruptor de seguridad.
 *
 * 2. ESTADO DEL NEGOCIO (SUSCRIPCIÓN):
 * Controla la viabilidad económica del servicio. Almacena qué plan ha pagado
 * el local ('tipoSuscripcion') y la fecha exacta de corte ('fechaFinSuscripcion').
 *
 * 3. UBICACIÓN FÍSICA (GEOLOCALIZACIÓN):
 * Almacena coordenadas GPS (latitud/longitud) precisas. Esto es vital para la
 * funcionalidad de "Check-in", asegurando que solo los clientes físicamente
 * presentes en el rango (100m) puedan interactuar con la Gramola.
 *
 * 4. INTEGRACIÓN SPOTIFY:
 * Guarda las credenciales OAuth (tokens) persistentes. Esto permite que el
 * servidor (Backend) controle la música automáticamente en nombre del usuario,
 * incluso si este cierra el navegador, manteniendo la sesión de música viva.
 * ======================================================================================
 */

package com.gramola.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

/*
 * @Data (Librería Lombok):
 * Esta anotación es fundamental para la limpieza del código.
 * Genera automáticamente durante la compilación:
 * - Todos los Getters y Setters.
 * - Métodos toString(), equals() y hashCode().
 * BENEFICIO: Elimina más de 100 líneas de código repetitivo (boilerplate),
 * haciendo la clase mucho más mantenible y legible.
 */
@Data

/*
 * @Entity (JPA/Hibernate):
 * Indica al framework que esta clase Java representa una TABLA en la base de datos.
 * Cada instancia u objeto de 'Bar' será una fila en dicha tabla.
 */
@Entity
@Table(name = "bares") // Mapeo explícito: La tabla en MySQL se llamará "bares".
public class Bar {

    // --- IDENTIFICADOR ÚNICO ---
    @Id // Marca este campo como la Clave Primaria (PK)
    @GeneratedValue(strategy = GenerationType.IDENTITY) // Auto-increment (1, 2, 3...)
    private Long id;

    // --- DATOS DE REGISTRO ---
    // 'nullable = false' impone una restricción NOT NULL en la base de datos.
    @Column(name = "nombre_bar", nullable = false)
    private String nombre;

    // 'unique = true' asegura que no existan dos bares con el mismo correo.
    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;
    // NOTA DEFENSA: Aunque veáis el nombre "password", en el servicio (BarService)
    // se encripta con BCrypt antes de llegar aquí. Nunca guardamos texto plano.

    // --- ESTADO DE LA CUENTA (Lógica de Negocio) ---
    // Este booleano es el control de acceso maestro.
    // Solo pasa a 'true' cuando se cumplen dos condiciones:
    // 1. Verificación del email.
    // 2. Pago confirmado de la suscripción.
    private boolean activo = false;

    @Column(name = "token_confirmacion")
    private String tokenConfirmacion; // Token temporal enviado al registrarse.

    // --- RECUPERACIÓN DE CONTRASEÑA ---
    @Column(name = "reset_password_token")
    private String resetPasswordToken; // Token único para restablecer credenciales.

    @Column(name = "reset_password_expires")
    private LocalDateTime resetPasswordExpires; // Seguridad: El token caduca (ej. 24h).

    // --- GESTIÓN DE SUSCRIPCIÓN ---
    // Almacena el plan actual: 'SUSCRIPCION_MENSUAL' o 'SUSCRIPCION_ANUAL'.
    @Column(name = "tipo_suscripcion")
    private String tipoSuscripcion;

    // Fecha crítica: el día que el servicio deja de funcionar si no se renueva.
    @Column(name = "fecha_fin_suscripcion")
    private LocalDate fechaFinSuscripcion;

    // --- GEOLOCALIZACIÓN (Google Maps / GPS) ---
    // Uso 'Double' (64 bits) para garantizar la precisión decimal necesaria
    // para las coordenadas GPS. 'Float' podría introducir errores de ubicación.
    private Double latitud;
    private Double longitud;

    // --- FIRMA DIGITAL (Imagen) ---
    /*
     * @Lob (Large Object):
     * Indica que este campo almacenará gran cantidad de datos (BLOB).
     * Decidí guardar la imagen como array de bytes (byte[]) directamente en la BD
     * para facilitar la portabilidad y los backups del sistema completo.
     */
    @Lob
    @Column(name = "firma_imagen", columnDefinition = "LONGBLOB")
    private byte[] firmaImagen;

    // --- INTEGRACIÓN SPOTIFY (OAuth 2.0) ---
    // Guardamos tokens, NO usuario/contraseña de Spotify.

    // Access Token: Llave temporal para controlar la API (dura 1 hora).
    // Ampliamos la longitud (2048) porque estos tokens son muy largos.
    @Column(name = "spotify_access_token", length = 2048)
    private String spotifyAccessToken;

    // Refresh Token: Llave maestra permanente para obtener nuevos Access Tokens
    // sin necesidad de pedirle al usuario que se loguee de nuevo.
    @Column(name = "spotify_refresh_token", length = 2048)
    private String spotifyRefreshToken;

    // Control de expiración: Sabemos exactamente cuándo renovar el token.
    @Column(name = "spotify_token_expires_at")
    private LocalDateTime spotifyTokenExpiresAt;
}