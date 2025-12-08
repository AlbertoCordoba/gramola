package com.gramola.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data // Lombok genera automáticamente getters, setters y toString
@Entity // Esto le dice a Spring que esta clase es una tabla de la BD
@Table(name = "bares") // El nombre exacto de la tabla en MySQL
public class Bar {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "nombre_bar", nullable = false)
    private String nombre;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    private boolean activo = false;

    @Column(name = "token_confirmacion")
    private String tokenConfirmacion;

    @Column(name = "tipo_suscripcion")
    private String tipoSuscripcion; // 'MENSUAL', 'ANUAL', etc.

    @Column(name = "fecha_fin_suscripcion")
    private LocalDate fechaFinSuscripcion;

    // Campos para los puntos extra
    private Double latitud;
    private Double longitud;

    @Lob // Indica que es un objeto grande (BLOB) para la imagen
    @Column(name = "firma_imagen", columnDefinition = "LONGBLOB")
    private byte[] firmaImagen;

    // --- INTEGRACIÓN REAL CON SPOTIFY ---
    // Guardamos los tokens aquí para que persistan tras reinicios
    @Column(name = "spotify_access_token", length = 2048)
    private String spotifyAccessToken;

    @Column(name = "spotify_refresh_token", length = 2048)
    private String spotifyRefreshToken;

    @Column(name = "spotify_token_expires_at")
    private LocalDateTime spotifyTokenExpiresAt;
}