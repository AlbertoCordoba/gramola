package com.gramola.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "canciones_solicitadas")
public class CancionSolicitada {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "bar_id")
    private Long barId;

    @Column(name = "spotify_id")
    private String spotifyId;

    private String titulo;
    private String artista;
    
    private String estado; // COLA, SONANDO, TERMINADA

    @Column(name = "fecha_solicitud")
    private LocalDateTime fechaSolicitud;
    
    @PrePersist
    protected void onCreate() {
        fechaSolicitud = LocalDateTime.now();
    }
}