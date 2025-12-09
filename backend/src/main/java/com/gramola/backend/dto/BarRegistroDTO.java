package com.gramola.backend.dto;

import lombok.Data;

@Data
public class BarRegistroDTO {
    private String nombre;
    private String email;
    private String password;
    private String confirmPassword;
    private Double latitud;
    private Double longitud;
    // NUEVO CAMPO: Firma en formato Base64
    private String firmaBase64;
}