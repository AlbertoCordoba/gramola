/*
 * ======================================================================================
 * RESUMEN
 * ======================================================================================
 * * ¿QUÉ ES ESTA CLASE?
 * Gestiona la interacción principal de los clientes: pedir música y ver qué está sonando.
 *
 * * PUNTOS CLAVE:
 * 1. OPERACIÓN ATÓMICA (Pago + Pedido):
 * El endpoint '/cola/add' recibe en una sola llamada los datos de la canción Y la
 * confirmación del pago. Esto simplifica el frontend y evita inconsistencias.
 *
 * 2. FLEXIBILIDAD (Map vs DTO):
 * Para el método 'anadir', uso un 'Map<String, Object>' en lugar de una clase rígida.
 * Esto me permite recibir datos heterogéneos (info de canción + flags de pago)
 * de forma dinámica y procesarlos en el servicio.
 *
 * 3. CONTROL DE ESTADO:
 * El endpoint '/cola/estado' permite que el reproductor (Frontend) notifique al
 * servidor cuando una canción termina, para mantener la base de datos sincronizada
 * con la realidad musical.
 * ======================================================================================
 */

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