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

    // --- AÑADIR CANCIÓN ---
    @PostMapping("/cola/add")
    public ResponseEntity<?> anadir(@RequestBody Map<String, Object> datos) {
        try {
            // El servicio coordina el pago y la inserción en BD
            gramolaService.anadirCancion(datos);
            return ResponseEntity.ok(Collections.singletonMap("mensaje", "Canción pagada y en cola"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    // --- LEER COLA (Próximas) ---
    @GetMapping("/cola/{barId}")
    public ResponseEntity<?> verCola(@PathVariable Long barId) {
        return ResponseEntity.ok(gramolaService.obtenerCola(barId));
    }

    // --- LEER HISTORIAL (Pasadas) ---
    @GetMapping("/historial/{barId}")
    public ResponseEntity<?> verHistorial(@PathVariable Long barId) {
        return ResponseEntity.ok(gramolaService.obtenerHistorial(barId));
    }

    // --- ACTUALIZAR ESTADO (Callback del Reproductor) ---
    @PostMapping("/cola/estado")
    public ResponseEntity<?> cambiarEstado(@RequestBody Map<String, Object> payload) {
        try {
            Long id = Long.valueOf(payload.get("id").toString());
            String estado = (String) payload.get("estado");
            gramolaService.actualizarEstado(id, estado);
            return ResponseEntity.ok(Collections.singletonMap("mensaje", "Estado actualizado"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        }
    }
}