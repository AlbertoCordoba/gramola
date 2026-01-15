package com.gramola.backend.service;

import com.gramola.backend.model.CancionSolicitada;
import com.gramola.backend.model.ConfiguracionPrecios;
import com.gramola.backend.model.Pagos;
import com.gramola.backend.repository.CancionSolicitadaRepository;
import com.gramola.backend.repository.ConfiguracionPreciosRepository;
import com.gramola.backend.repository.PagosRepository;
import com.stripe.Stripe;
import com.stripe.model.PaymentIntent;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
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
    private ConfiguracionPreciosRepository preciosRepository;

    @Value("${stripe.key.secret}")
    private String stripeSecretKey;

    @Transactional
    public CancionSolicitada anadirCancion(Map<String, Object> datos) throws Exception {
        
        // 1. Obtener precio de la BD
        BigDecimal precioDb = preciosRepository.findByClave("PRECIO_CANCION")
            .map(ConfiguracionPrecios::getValor)
            .orElseThrow(() -> new RuntimeException("Error: Precio de canción no configurado en BD"));

        // 2. Verificar pago con Stripe
        String transactionId = (String) datos.get("stripeTransactionId");
        if (transactionId == null || transactionId.isEmpty()) {
            throw new Exception("Falta el ID del pago de Stripe.");
        }

        try {
            Stripe.apiKey = stripeSecretKey;
            PaymentIntent payment = PaymentIntent.retrieve(transactionId);

            if (!"succeeded".equals(payment.getStatus())) {
                throw new Exception("El pago no está confirmado. Estado: " + payment.getStatus());
            }

            long importePagadoCentimos = payment.getAmount();
            long importeEsperadoCentimos = precioDb.multiply(new BigDecimal(100)).longValue();

            if (importePagadoCentimos < importeEsperadoCentimos) {
                throw new Exception("Fraude detectado: Se pagó menos del precio estipulado.");
            }

        } catch (Exception e) {
            throw new Exception("Error validando el pago: " + e.getMessage());
        }

        // 3. Crear la canción (CORRECCIÓN AQUÍ)
        Long barId = Long.valueOf(datos.get("barId").toString());
        
        CancionSolicitada cancion = new CancionSolicitada();
        cancion.setBarId(barId);
        cancion.setSpotifyId((String) datos.get("spotifyId"));
        
        // --- CAMBIO CLAVE: Usamos "titulo" para coincidir con el Frontend
        cancion.setTitulo((String) datos.get("titulo")); 
        
        cancion.setArtista((String) datos.get("artista"));
        
        if (datos.containsKey("imagenUrl")) {
            cancion.setImagenUrl((String) datos.get("imagenUrl"));
        }
        
        if (datos.containsKey("duracionMs")) {
            Object d = datos.get("duracionMs");
            cancion.setDuracionMs(d instanceof Number ? ((Number) d).intValue() : 0);
        }
        
        cancion.setEstado("COLA");
        cancion = cancionRepository.save(cancion);

        // 4. Registrar pago
        Pagos pago = new Pagos();
        pago.setBarId(barId);
        pago.setCancionId(cancion.getId());
        pago.setConcepto("Canción: " + cancion.getTitulo());
        pago.setMonto(precioDb);
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