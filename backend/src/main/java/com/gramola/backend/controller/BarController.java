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
            return ResponseEntity.ok(Collections.singletonMap("mensaje", "Registro correcto. Revisa tu email."));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    // REDIRECCIÓN TRAS VERIFICAR
    @GetMapping("/verificar")
    public RedirectView verificarEmail(@RequestParam String token) {
        try {
            barService.confirmarCuenta(token);
            // Redirige al frontend a la página de pagos
            return new RedirectView("http://localhost:4200/pagos?verificado=true");
        } catch (Exception e) {
            return new RedirectView("http://localhost:4200/login?error=token_invalido");
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

    @PostMapping("/logout")
    public ResponseEntity<?> logout() {
        return ResponseEntity.ok(Collections.singletonMap("mensaje", "Sesión cerrada"));
    }

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

    @GetMapping("/precios")
    public ResponseEntity<?> getPrecios() {
        return ResponseEntity.ok(barService.obtenerPrecios());
    }

    @PostMapping("/suscripcion")
    public ResponseEntity<?> activarSuscripcion(@RequestBody Map<String, Object> payload) {
        try {
            // El frontend debe enviar el email del usuario para saber a quién activar
            String email = (String) payload.get("email");
            String tipo = (String) payload.get("tipo");
            barService.activarSuscripcion(email, tipo);
            return ResponseEntity.ok(Collections.singletonMap("mensaje", "Suscripción activada."));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        }
    }
}