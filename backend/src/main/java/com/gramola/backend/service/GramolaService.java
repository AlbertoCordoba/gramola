/*
 * ======================================================================================
 * RESUMEN
 * ======================================================================================
 * * ¿QUÉ ES ESTA CLASE?
 * El 'GramolaService' es el CEREBRO de la aplicación. Contiene toda la lógica de negocio
 * pura. El Controlador recibe la petición web, pero este Servicio es quien realmente
 * "hace el trabajo sucio".
 *
 * * PUNTOS CLAVE:
 * 1. TRANSACCIONALIDAD (@Transactional):
 * Esta es la joya de la corona. El método 'anadirCancion' hace dos cosas críticas:
 * a) Cobra al usuario (PaymentService).
 * b) Guarda la canción en la base de datos.
 * Gracias a @Transactional, si el pago falla, la canción NO se guarda. Y si la base
 * de datos falla, el pago se revierte (lógicamente). Todo o nada (Atomicidad).
 *
 * 2. ORQUESTACIÓN:
 * Coordina múltiples repositorios: busca el precio actual en 'ConfiguracionPrecios',
 * guarda el registro en 'PagosRepository' y la canción en 'CancionSolicitadaRepository'.
 *
 * 3. VALIDACIÓN DE NEGOCIO:
 * Se asegura de que la canción nazca siempre con el estado inicial correcto ("COLA")
 * y asigna los metadatos necesarios antes de persistir.
 * ======================================================================================
 */

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

    /*
     * @Transactional:
     * Si ocurre cualquier error dentro de este método (ej: tarjeta rechazada),
     * Spring hace un "Rollback" automático y deshace cualquier cambio en la BD.
     * Garantiza que nunca tengamos una canción en la cola que no haya sido pagada.
     */
    @Transactional
    public CancionSolicitada anadirCancion(Map<String, Object> datos) {
        // 1. Procesar el pago (simulado)
        boolean simularError = datos.containsKey("simularError") ? (boolean) datos.get("simularError") : false;
        try {
            paymentService.procesarPago(simularError);
        } catch (Exception e) {
            throw new RuntimeException(e.getMessage()); // Esto dispara el Rollback
        }

        // 2. Obtener el precio actual de la BD (no hardcodeado)
        BigDecimal precioCancion = preciosRepository.findByClave("PRECIO_CANCION")
            .map(ConfiguracionPrecios::getValor)
            .orElseThrow(() -> new RuntimeException("No se ha configurado el precio de la canción en la base de datos"));

        // 3. Crear la entidad Canción
        Long barId = Long.valueOf(datos.get("barId").toString());
        CancionSolicitada cancion = new CancionSolicitada();
        cancion.setBarId(barId);
        cancion.setSpotifyId((String) datos.get("spotifyId"));
        cancion.setTitulo((String) datos.get("titulo"));
        cancion.setArtista((String) datos.get("artista"));
        
        // Guardamos la imagen para el frontend (Confirmado que se usa)
        if (datos.containsKey("imagenUrl")) {
            cancion.setImagenUrl((String) datos.get("imagenUrl"));
        }
        
        Object duracionObj = datos.get("duracionMs");
        cancion.setDuracionMs(duracionObj instanceof Number ? ((Number) duracionObj).intValue() : 0);
        
        cancion.setEstado("COLA"); // Estado inicial obligatorio
        cancion = cancionRepository.save(cancion);

        // 4. Registrar el pago en el historial financiero
        Pagos pago = new Pagos();
        pago.setBarId(barId);
        pago.setCancionId(cancion.getId());
        pago.setConcepto("PAGO_CANCION");
        pago.setMonto(precioCancion);
        pago.setFechaPago(LocalDateTime.now());
        pagosRepository.save(pago);

        return cancion;
    }

    // --- MÉTODOS DE LECTURA ---
    
    public List<CancionSolicitada> obtenerCola(Long barId) {
        // Recupera las canciones en orden FIFO (la más antigua primero)
        return cancionRepository.findByBarIdAndEstadoOrderByFechaSolicitudAsc(barId, "COLA");
    }

    public List<CancionSolicitada> obtenerHistorial(Long barId) {
        // Recupera las últimas 5 canciones terminadas (LIFO)
        return cancionRepository.findTop5ByBarIdAndEstadoOrderByFechaSolicitudDesc(barId, "TERMINADA");
    }

    // --- GESTIÓN DE ESTADO ---
    
    @Transactional
    public void actualizarEstado(Long id, String estado) {
        CancionSolicitada c = cancionRepository.findById(id).orElseThrow();
        c.setEstado(estado);
        cancionRepository.save(c);
    }
}