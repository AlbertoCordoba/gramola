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

    // MÉTODO: Recibe los datos de una canción pagada y coordina con el servicio su inserción en la cola.
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

    // MÉTODO: Devuelve la lista de canciones que están en estado 'ESPERANDO' para un bar específico.
    @GetMapping("/cola/{barId}")
    public ResponseEntity<?> verCola(@PathVariable Long barId) {
        return ResponseEntity.ok(gramolaService.obtenerCola(barId));
    }

   // MÉTODO: Recupera el listado de canciones que ya han sido reproducidas ('TERMINADA') en ese local.
    @GetMapping("/historial/{barId}")
    public ResponseEntity<?> verHistorial(@PathVariable Long barId) {
        return ResponseEntity.ok(gramolaService.obtenerHistorial(barId));
    }

    // MÉTODO: Callback vital. El reproductor del Front avisa aquí cuando una canción cambia a 'SONANDO' o 'TERMINADA'.
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