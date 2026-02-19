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

    // MÉTODO: Procesa el formulario de registro. Delega al servicio el hasheo de claves y envío de email.
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

    // MÉTODO: Punto de retorno del email. Valida el token y redirige al usuario a la pantalla de pagos.
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

    // MÉTODO: Autenticación del bar. El servicio verifica la contraseña y la distancia GPS (máximo 100m).
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
    // MÉTODO: Cierra la sesión activa del usuario.
    @PostMapping("/logout")
    public ResponseEntity<?> logout() {
        return ResponseEntity.ok(Collections.singletonMap("mensaje", "Sesión cerrada"));
    }

   // MÉTODO: Genera un token de recuperación y envía un enlace al correo del dueño del bar.
    @PostMapping("/recuperar-password")
    public ResponseEntity<?> recuperarPassword(@RequestBody Map<String, String> payload) {
        try {
            barService.solicitarRecuperacion(payload.get("email"));
            return ResponseEntity.ok(Collections.singletonMap("mensaje", "Correo enviado."));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        }
    }
    // MÉTODO: Sobreescribe la contraseña antigua por la nueva tras validar el token de recuperación.
    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> payload) {
        try {
            barService.restablecerPassword(payload.get("token"), payload.get("password"));
            return ResponseEntity.ok(Collections.singletonMap("mensaje", "Contraseña cambiada."));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    // MÉTODO: Devuelve los importes actuales de canciones y suscripciones desde la base de datos.
    @GetMapping("/precios")
    public ResponseEntity<?> getPrecios() {
        return ResponseEntity.ok(barService.obtenerPrecios());
    }
    // MÉTODO: Finaliza el proceso de alta. Activa el bar y calcula la fecha de fin según el plan elegido.
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