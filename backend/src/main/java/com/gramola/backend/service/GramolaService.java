package com.gramola.backend.service;

import com.gramola.backend.model.CancionSolicitada;
import com.gramola.backend.model.ConfiguracionPrecios;
import com.gramola.backend.model.Pagos;
import com.gramola.backend.repository.CancionSolicitadaRepository;
import com.gramola.backend.repository.ConfiguracionPreciosRepository;
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
    @Autowired
    private MockPaymentService paymentService;
    @Autowired
    private ConfiguracionPreciosRepository preciosRepository;

    @Transactional
    public CancionSolicitada anadirCancion(Map<String, Object> datos) {
        boolean simularError = datos.containsKey("simularError") ? (boolean) datos.get("simularError") : false;
        try {
            paymentService.procesarPago(simularError);
        } catch (Exception e) {
            throw new RuntimeException(e.getMessage());
        }

        BigDecimal precioCancion = preciosRepository.findByClave("PRECIO_CANCION")
            .map(ConfiguracionPrecios::getValor)
            .orElseThrow(() -> new RuntimeException("No se ha configurado el precio de la canción en la base de datos"));

        Long barId = Long.valueOf(datos.get("barId").toString());
        CancionSolicitada cancion = new CancionSolicitada();
        cancion.setBarId(barId);
        cancion.setSpotifyId((String) datos.get("spotifyId"));
        cancion.setTitulo((String) datos.get("titulo"));
        cancion.setArtista((String) datos.get("artista"));
        cancion.setPreviewUrl((String) datos.get("previewUrl"));
        
        // --- NUEVO: GUARDAR IMAGEN ---
        if (datos.containsKey("imagenUrl")) {
            cancion.setImagenUrl((String) datos.get("imagenUrl"));
        }
        
        Object duracionObj = datos.get("duracionMs");
        cancion.setDuracionMs(duracionObj instanceof Number ? ((Number) duracionObj).intValue() : 0);
        
        cancion.setEstado("COLA");
        cancion = cancionRepository.save(cancion);

        Pagos pago = new Pagos();
        pago.setBarId(barId);
        pago.setCancionId(cancion.getId());
        pago.setConcepto("PAGO_CANCION");
        pago.setMonto(precioCancion);
        pago.setFechaPago(LocalDateTime.now());
        pagosRepository.save(pago);

        return cancion;
    }

    public List<CancionSolicitada> obtenerCola(Long barId) {
        return cancionRepository.findByBarIdAndEstadoOrderByFechaSolicitudAsc(barId, "COLA");
    }

    public List<CancionSolicitada> obtenerHistorial(Long barId) {
        return cancionRepository.findTop5ByBarIdAndEstadoOrderByFechaSolicitudDesc(barId, "TERMINADA");
    }

    @Transactional
    public void actualizarEstado(Long id, String estado) {
        CancionSolicitada c = cancionRepository.findById(id).orElseThrow();
        c.setEstado(estado);
        cancionRepository.save(c);
    }
}