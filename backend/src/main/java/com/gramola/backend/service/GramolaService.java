package com.gramola.backend.service;

import com.gramola.backend.model.CancionSolicitada;
import com.gramola.backend.model.Pagos;
import com.gramola.backend.repository.CancionSolicitadaRepository;
import com.gramola.backend.repository.PagosRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
public class GramolaService {

    @Autowired
    private CancionSolicitadaRepository cancionRepository;

    @Autowired
    private PagosRepository pagosRepository;

    @Transactional
    public CancionSolicitada anadirCancion(Map<String, Object> datos) {
        Long barId = Long.valueOf(datos.get("barId").toString());
        
        // 1. Crear y guardar la canción en COLA
        CancionSolicitada cancion = new CancionSolicitada();
        cancion.setBarId(barId);
        cancion.setSpotifyId((String) datos.get("spotifyId"));
        cancion.setTitulo((String) datos.get("titulo"));
        cancion.setArtista((String) datos.get("artista"));
        cancion.setEstado("COLA");
        
        cancion = cancionRepository.save(cancion);

        // 2. Simular el registro del pago (Requisito de la práctica)
        Pagos pago = new Pagos();
        pago.setBarId(barId);
        pago.setCancionId(cancion.getId());
        pago.setConcepto("PAGO_CANCION");
        pago.setMonto(new BigDecimal("0.50"));
        pago.setFechaPago(LocalDateTime.now());
        
        pagosRepository.save(pago);

        return cancion;
    }

    public List<CancionSolicitada> obtenerCola(Long barId) {
        return cancionRepository.findByBarIdAndEstadoOrderByFechaSolicitudAsc(barId, "COLA");
    }
}