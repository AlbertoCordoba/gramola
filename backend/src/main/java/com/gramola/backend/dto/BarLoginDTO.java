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