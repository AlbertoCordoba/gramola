package com.gramola.backend.controller;

import com.gramola.backend.dto.BarRegistroDTO;
import com.gramola.backend.service.BarService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.gramola.backend.dto.BarLoginDTO;
import com.gramola.backend.model.Bar;

@RestController
@RequestMapping("/api/bares")
@CrossOrigin(origins = "http://localhost:4200") // Permitir peticiones desde Angular
public class BarController {

    @Autowired
    private BarService barService;

    @PostMapping("/registro")
    public ResponseEntity<?> registrar(@RequestBody BarRegistroDTO barDTO) {
        try {
            barService.registrarBar(barDTO);
            return ResponseEntity.ok("Bar registrado correctamente. Por favor revisa tu email.");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody BarLoginDTO loginDTO) {
        try {
            Bar bar = barService.login(loginDTO);
            return ResponseEntity.ok(bar); // Devolvemos los datos del bar al front
        } catch (Exception e) {
            // Devolvemos un error 401 (No autorizado)
            return ResponseEntity.status(401).body("Error: " + e.getMessage());
        }
    }

}