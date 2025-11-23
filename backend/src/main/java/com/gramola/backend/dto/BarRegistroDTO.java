package com.gramola.backend.dto;

import lombok.Data;

@Data
public class BarRegistroDTO {
    private String nombre;
    private String email;
    private String password;
    private String confirmPassword;
    // Opcionales para puntos extra
    private Double latitud;
    private Double longitud;
}