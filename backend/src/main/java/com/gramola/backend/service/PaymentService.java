package com.gramola.backend.service;

import com.gramola.backend.model.ConfiguracionPrecios;
import com.gramola.backend.model.StripeTransaction;
import com.gramola.backend.repository.ConfiguracionPreciosRepository;
import com.gramola.backend.repository.StripeTransactionRepository;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.PaymentIntent;
import com.stripe.param.PaymentIntentCreateParams;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;
import java.math.BigDecimal;

@Service
public class PaymentService {

    @Autowired
    private StripeTransactionRepository dao;

    @Autowired
    private ConfiguracionPreciosRepository preciosRepository;

    @Value("${stripe.key.secret}")
    private String secretKey;
    // MÉTODO: Inicializa la configuración de Stripe usando la clave secreta definida en application.properties.
    @PostConstruct
    public void init() {
        Stripe.apiKey = secretKey;
    }
    // MÉTODO: Crea una intención de pago (PaymentIntent). Calcula el precio desde la BD, 
    // lo convierte a céntimos (exigencia de Stripe) y genera un 'client_secret' para el Frontend.
    public StripeTransaction prepay(String email, String tipoPago) throws StripeException {
        // 1. Obtención dinámica del precio
        String claveBD = tipoPago.equalsIgnoreCase("CANCION") ? "PRECIO_CANCION" : "SUSCRIPCION_MENSUAL";
        
        BigDecimal precioBD = preciosRepository.findAll().stream()
                .filter(p -> p.getClave().trim().equalsIgnoreCase(claveBD))
                .map(ConfiguracionPrecios::getValor)
                .findFirst()
                .orElse(new BigDecimal("10.00")); 

        long amountCents = precioBD.multiply(new BigDecimal(100)).longValue();

        // 2. Creación de la intención en Stripe con el email real
        PaymentIntentCreateParams params = PaymentIntentCreateParams.builder()
                .setCurrency("eur")
                .setAmount(amountCents)
                .setDescription("Gramola: " + tipoPago + " - " + email)
                .setReceiptEmail(email) 
                .setAutomaticPaymentMethods(
                    PaymentIntentCreateParams.AutomaticPaymentMethods.builder()
                        .setEnabled(true)
                        .build()
                )
                .build();

        PaymentIntent intent = PaymentIntent.create(params);

        // 3. Guardar información limpia en la BD (Evita el bloque gigante de texto)
        // Creamos un JSON pequeño solo con lo que el Front necesita
        JSONObject datosLimpios = new JSONObject();
        datosLimpios.put("client_secret", intent.getClientSecret());
        datosLimpios.put("amount", precioBD);
        datosLimpios.put("status", intent.getStatus());

        StripeTransaction st = new StripeTransaction();
        st.setId(intent.getId());
        st.setData(datosLimpios.toString()); // Ya no guardamos el intent.toJson() entero
        st.setEmail(email);
        
        return this.dao.save(st);
    }
}