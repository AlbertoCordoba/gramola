package com.gramola.backend.dto;

import lombok.Data;

@Data
public class BarLoginDTO {
    private String email;
    private String password;
    private Double lat;
    private Double lng;
}