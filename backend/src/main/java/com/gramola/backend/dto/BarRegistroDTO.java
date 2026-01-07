package com.gramola.backend.dto;

import lombok.Data;

@Data
public class BarRegistroDTO {
    
    // Datos básicos
    private String nombre;
    private String email;
    
    // Seguridad
    private String password;
    private String confirmPassword;
    
    // --- NUEVO: Credenciales de Spotify ---
    private String clientId;
    private String clientSecret;
    // -------------------------------------
    
    // Ubicación
    private Double latitud;
    private Double longitud;
    
    // Firma Digital
    private String firmaBase64;
}