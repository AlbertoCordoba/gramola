package com.gramola.backend.controller;

import com.gramola.backend.service.GramolaService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.Map;

@RestController
@RequestMapping("/api/gramola")
@CrossOrigin(origins = "http://localhost:4200")
public class GramolaController {

    @Autowired
    private GramolaService gramolaService;

    @PostMapping("/cola/add")
    public ResponseEntity<?> anadir(@RequestBody Map<String, Object> datos) {
        try {
            gramolaService.anadirCancion(datos);
            return ResponseEntity.ok(Collections.singletonMap("mensaje", "Canción pagada y en cola"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    @GetMapping("/cola/{barId}")
    public ResponseEntity<?> verCola(@PathVariable Long barId) {
        return ResponseEntity.ok(gramolaService.obtenerCola(barId));
    }

    // NUEVO ENDPOINT: Para que el frontend avise cuando una canción empieza/termina
    @PostMapping("/cola/estado")
    public ResponseEntity<?> cambiarEstado(@RequestBody Map<String, Object> payload) {
        // Convertimos el ID de String/Integer a Long para la BD
        Long id = Long.valueOf(payload.get("id").toString());
        String estado = (String) payload.get("estado");
        
        gramolaService.actualizarEstado(id, estado);
        return ResponseEntity.ok().build();
    }
}