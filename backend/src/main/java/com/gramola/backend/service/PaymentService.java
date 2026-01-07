package com.gramola.backend.service;

import com.gramola.backend.model.StripeTransaction;
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

@Service
public class PaymentService {

    @Autowired
    private StripeTransactionRepository dao;

    // Inyectamos la clave desde application.properties
    @Value("${stripe.key.secret}")
    private String secretKey;

    @PostConstruct
    public void init() {
        Stripe.apiKey = secretKey;
    }

    public StripeTransaction prepay(String email) throws StripeException {
        // 1. Crear intención de pago en Stripe (10.00€)
        PaymentIntentCreateParams params = PaymentIntentCreateParams.builder()
                .setCurrency("eur")
                .setAmount(1000L) // 1000 céntimos = 10€
                .setDescription("Gramola Pago - " + email)
                .build();

        PaymentIntent intent = PaymentIntent.create(params);

        // 2. Guardar datos técnicos (JSON) en nuestra BD
        JSONObject json = new JSONObject(intent.toJson());
        StripeTransaction st = new StripeTransaction();
        st.setId(intent.getId());
        st.setData(json.toString());
        st.setEmail(email);
        
        return this.dao.save(st);
    }
}