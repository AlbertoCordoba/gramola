package com.gramola.backend.controller;

import com.gramola.backend.dto.BarLoginDTO;
import com.gramola.backend.dto.BarRegistroDTO;
import com.gramola.backend.model.Bar;
import com.gramola.backend.service.BarService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.view.RedirectView;
import java.util.Collections;
import java.util.Map;

/*
 * @RestController: Indica que esta clase responde con datos (JSON), no con HTML.
 * @CrossOrigin: VITAL. Permite que el Frontend (puerto 4200) hable con el Backend (8080).
 */
@RestController
@RequestMapping("/api/bares")
@CrossOrigin(origins = "http://localhost:4200")
public class BarController {

    @Autowired
    private BarService barService;

    // --- REGISTRO ---
    @PostMapping("/registro")
    public ResponseEntity<?> registrar(@RequestBody BarRegistroDTO barDTO) {
        try {
            // Delegamos la lógica compleja (hashear pass, crear token) al servicio
            barService.registrarBar(barDTO);
            return ResponseEntity.ok(Collections.singletonMap("mensaje", "Registro correcto. Revisa tu email."));
        } catch (Exception e) {
            // Si el email ya existe o fallan las claves, devolvemos error 400
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    // --- VERIFICACIÓN DE EMAIL (Redirección) ---
    @GetMapping("/verificar")
    public RedirectView verificarEmail(@RequestParam String token) {
        try {
            barService.confirmarCuenta(token);
            // Si valida OK -> Redirige a la pantalla de pagos del Frontend
            return new RedirectView("http://localhost:4200/pagos?verificado=true");
        } catch (Exception e) {
            // Si falla -> Redirige al login con aviso de error
            return new RedirectView("http://localhost:4200/login?error=token_invalido");
        }
    }

    // --- LOGIN (Con Geolocalización) ---
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody BarLoginDTO loginDTO) {
        try {
            // El servicio validará Password + Distancia GPS
            Bar bar = barService.login(loginDTO);
            return ResponseEntity.ok(bar);
        } catch (Exception e) {
            // Error 401 (Unauthorized) si falla la autenticación
            return ResponseEntity.status(401).body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout() {
        return ResponseEntity.ok(Collections.singletonMap("mensaje", "Sesión cerrada"));
    }

    // --- RECUPERACIÓN DE CONTRASEÑA ---
    @PostMapping("/recuperar-password")
    public ResponseEntity<?> recuperarPassword(@RequestBody Map<String, String> payload) {
        try {
            barService.solicitarRecuperacion(payload.get("email"));
            return ResponseEntity.ok(Collections.singletonMap("mensaje", "Correo enviado."));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> payload) {
        try {
            barService.restablecerPassword(payload.get("token"), payload.get("password"));
            return ResponseEntity.ok(Collections.singletonMap("mensaje", "Contraseña cambiada."));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    // --- PAGOS Y PRECIOS ---
    @GetMapping("/precios")
    public ResponseEntity<?> getPrecios() {
        return ResponseEntity.ok(barService.obtenerPrecios());
    }

    @PostMapping("/suscripcion")
    public ResponseEntity<?> activarSuscripcion(@RequestBody Map<String, Object> payload) {
        try {
            String email = (String) payload.get("email");
            String tipo = (String) payload.get("tipo");
            boolean simularError = payload.containsKey("simularError") ? (boolean) payload.get("simularError") : false;
            
            barService.activarSuscripcion(email, tipo, simularError);
            return ResponseEntity.ok(Collections.singletonMap("mensaje", "Suscripción activada y pagada."));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        }
    }
}