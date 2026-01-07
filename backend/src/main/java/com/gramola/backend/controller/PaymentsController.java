package com.gramola.backend.controller;

import com.gramola.backend.model.StripeTransaction;
import com.gramola.backend.service.PaymentService;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/payments")
@CrossOrigin(origins = "http://localhost:4200", allowCredentials = "true")
public class PaymentsController {

    @Autowired
    private PaymentService service;

    @GetMapping("/prepay")
    public StripeTransaction prepay(@RequestParam String email) {
        try {
            return this.service.prepay(email);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }
}