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
        // La ID del bar se convierte de String (JSON) a Long (Java)
        Long barId = Long.valueOf(datos.get("barId").toString());
        
        CancionSolicitada cancion = new CancionSolicitada();
        cancion.setBarId(barId);
        cancion.setSpotifyId((String) datos.get("spotifyId"));
        cancion.setTitulo((String) datos.get("titulo"));
        cancion.setArtista((String) datos.get("artista"));
        // ACEPTAMOS Y GUARDAMOS LA URL DE AUDIO
        cancion.setPreviewUrl((String) datos.get("previewUrl"));
        Object duracionMsObj = datos.get("duracionMs");
        if (duracionMsObj != null) {
            if (duracionMsObj instanceof Number) {
                cancion.setDuracionMs(((Number) duracionMsObj).intValue());
            } else {
                try {
                    cancion.setDuracionMs(Integer.parseInt(duracionMsObj.toString()));
                } catch (NumberFormatException e) {
                    cancion.setDuracionMs(0);
                }
            }
        } else {
            cancion.setDuracionMs(0);
        }
        cancion.setEstado("COLA");
        
        cancion = cancionRepository.save(cancion);

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

    // NUEVO: Método para cambiar estado (ej: cuando termina de sonar)
    @Transactional
    public void actualizarEstado(Long id, String estado) {
        CancionSolicitada c = cancionRepository.findById(id).orElseThrow();
        c.setEstado(estado);
        cancionRepository.save(c);
    }
}