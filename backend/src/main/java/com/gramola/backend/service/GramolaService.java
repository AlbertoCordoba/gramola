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
    
    // INYECCIÓN DEL SERVICIO DE PAGOS
    @Autowired
    private MockPaymentService paymentService;

    @Transactional
    public CancionSolicitada anadirCancion(Map<String, Object> datos) {
        // 1. PROCESAR PAGO (0.50€)
        boolean simularError = datos.containsKey("simularError") ? (boolean) datos.get("simularError") : false;
        
        try {
            paymentService.procesarPago(simularError);
        } catch (Exception e) {
            // Lanzamos RuntimeException para que @Transactional haga rollback
            throw new RuntimeException(e.getMessage());
        }

        // 2. GUARDAR CANCIÓN (Solo si el pago fue bien)
        Long barId = Long.valueOf(datos.get("barId").toString());
        
        CancionSolicitada cancion = new CancionSolicitada();
        cancion.setBarId(barId);
        cancion.setSpotifyId((String) datos.get("spotifyId"));
        cancion.setTitulo((String) datos.get("titulo"));
        cancion.setArtista((String) datos.get("artista"));
        cancion.setPreviewUrl((String) datos.get("previewUrl"));
        
        Object duracionMsObj = datos.get("duracionMs");
        if (duracionMsObj instanceof Number) {
            cancion.setDuracionMs(((Number) duracionMsObj).intValue());
        } else {
            cancion.setDuracionMs(0);
        }
        
        cancion.setEstado("COLA");
        cancion = cancionRepository.save(cancion);

        // 3. REGISTRAR PAGO EN HISTÓRICO
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

    @Transactional
    public void actualizarEstado(Long id, String estado) {
        CancionSolicitada c = cancionRepository.findById(id).orElseThrow();
        c.setEstado(estado);
        cancionRepository.save(c);
    }
}