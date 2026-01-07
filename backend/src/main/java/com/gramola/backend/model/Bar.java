package com.gramola.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "bares")
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

    @Column(name = "reset_password_token")
    private String resetPasswordToken;

    @Column(name = "reset_password_expires")
    private LocalDateTime resetPasswordExpires;

    @Column(name = "tipo_suscripcion")
    private String tipoSuscripcion;

    @Column(name = "fecha_fin_suscripcion")
    private LocalDate fechaFinSuscripcion;

    private Double latitud;
    private Double longitud;

    @Lob
    @Column(name = "firma_imagen", columnDefinition = "LONGBLOB")
    private byte[] firmaImagen;

    // --- NUEVO: Credenciales de la App Spotify del Bar ---
    @Column(name = "spotify_client_id")
    private String clientId;

    @Column(name = "spotify_client_secret")
    private String clientSecret; // Se guardará CIFRADO
    // ----------------------------------------------------

    @Column(name = "spotify_access_token", length = 2048)
    private String spotifyAccessToken;

    @Column(name = "spotify_refresh_token", length = 2048)
    private String spotifyRefreshToken;

    @Column(name = "spotify_token_expires_at")
    private LocalDateTime spotifyTokenExpiresAt;
}