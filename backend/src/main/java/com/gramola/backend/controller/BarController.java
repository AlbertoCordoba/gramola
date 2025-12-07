package com.gramola.backend.controller;

import com.gramola.backend.dto.BarRegistroDTO;
import com.gramola.backend.service.BarService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.gramola.backend.dto.BarLoginDTO;
import com.gramola.backend.model.Bar;

import java.util.Collections; // Import necesario para el mapa

@RestController
@RequestMapping("/api/bares")
@CrossOrigin(origins = "http://localhost:4200")
public class BarController {

    @Autowired
    private BarService barService;

    @PostMapping("/registro")
    public ResponseEntity<?> registrar(@RequestBody BarRegistroDTO barDTO) {
        try {
            barService.registrarBar(barDTO);
            // CAMBIO: Devolvemos un JSON { "mensaje": "..." } en vez de texto plano
            return ResponseEntity.ok(Collections.singletonMap("mensaje", "Bar registrado correctamente. Por favor revisa tu email."));
        } catch (Exception e) {
            // También devolvemos el error como JSON para ser consistentes
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody BarLoginDTO loginDTO) {
        try {
            Bar bar = barService.login(loginDTO);
            return ResponseEntity.ok(bar);
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Collections.singletonMap("error", e.getMessage()));
        }
    }
}