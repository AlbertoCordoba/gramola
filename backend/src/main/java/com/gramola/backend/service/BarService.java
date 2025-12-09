package com.gramola.backend.service;

import com.gramola.backend.dto.BarLoginDTO;
import com.gramola.backend.dto.BarRegistroDTO;
import com.gramola.backend.model.Bar;
import com.gramola.backend.model.ConfiguracionPrecios;
import com.gramola.backend.repository.BarRepository;
import com.gramola.backend.repository.ConfiguracionPreciosRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class BarService {

    @Autowired
    private BarRepository barRepository;

    @Autowired
    private ConfiguracionPreciosRepository preciosRepository;

    @Autowired
    private EmailService emailService;

    // --- CORRECCIÓN AQUÍ ---
    public Map<String, BigDecimal> obtenerPrecios() {
        Map<String, BigDecimal> precios = new HashMap<>();
        List<ConfiguracionPrecios> lista = preciosRepository.findAll();

        System.out.println("--- LEYENDO PRECIOS (POR CLAVE) ---");
        for (ConfiguracionPrecios p : lista) {
            // Usamos getClave() porque es donde está el dato real ('SUSCRIPCION_MENSUAL')
            String claveLimpia = p.getClave() != null ? p.getClave().trim() : "NULO";
            BigDecimal valor = p.getValor();
            
            System.out.println("Cargado: " + claveLimpia + " -> " + valor);
            
            if (p.getClave() != null) {
                precios.put(claveLimpia, valor);
            }
        }
        System.out.println("-----------------------------------");
        
        return precios;
    }

    public void registrarBar(BarRegistroDTO datos) throws Exception {
        if (barRepository.existsByEmail(datos.getEmail())) throw new Exception("El email ya existe");
        if (!datos.getPassword().equals(datos.getConfirmPassword())) throw new Exception("Las contraseñas no coinciden");

        Bar bar = new Bar();
        bar.setNombre(datos.getNombre());
        bar.setEmail(datos.getEmail());
        bar.setPassword(datos.getPassword()); 
        bar.setLatitud(datos.getLatitud());
        bar.setLongitud(datos.getLongitud());
        
        String token = UUID.randomUUID().toString();
        bar.setTokenConfirmacion(token);
        bar.setActivo(false);

        barRepository.save(bar);
        emailService.sendWelcomeEmail(bar.getEmail(), token);
    }

    public void confirmarCuenta(String token) throws Exception {
        Bar bar = barRepository.findByTokenConfirmacion(token)
                .orElseThrow(() -> new Exception("Token inválido"));
        bar.setTokenConfirmacion(null);
        barRepository.save(bar);
    }

    public Bar login(BarLoginDTO datos) throws Exception {
        Bar bar = barRepository.findByEmail(datos.getEmail())
                .orElseThrow(() -> new Exception("Usuario no encontrado"));

        if (!bar.getPassword().equals(datos.getPassword())) throw new Exception("Contraseña incorrecta");
        if (bar.getTokenConfirmacion() != null) throw new Exception("Debes confirmar tu email primero.");
        if (!bar.isActivo()) throw new Exception("Debes completar el pago de la suscripción.");

        return bar;
    }

    public void solicitarRecuperacion(String email) throws Exception {
        Optional<Bar> barOpt = barRepository.findByEmail(email);
        if (barOpt.isPresent()) {
            Bar bar = barOpt.get();
            String token = UUID.randomUUID().toString();
            bar.setResetPasswordToken(token);
            bar.setResetPasswordExpires(LocalDateTime.now().plusHours(24));
            barRepository.save(bar);
            emailService.sendPasswordRecoveryEmail(bar.getEmail(), token);
        }
    }

    public void restablecerPassword(String token, String newPassword) throws Exception {
        Bar bar = barRepository.findByResetPasswordToken(token)
                .orElseThrow(() -> new Exception("Token inválido"));
        if (bar.getResetPasswordExpires().isBefore(LocalDateTime.now())) throw new Exception("Token expirado");

        bar.setPassword(newPassword);
        bar.setResetPasswordToken(null);
        bar.setResetPasswordExpires(null);
        barRepository.save(bar);
    }

    public void activarSuscripcion(String email, String tipo) throws Exception {
        Bar bar = barRepository.findByEmail(email).orElseThrow(() -> new Exception("Usuario no encontrado"));
        activarSuscripcion(bar.getId(), tipo);
    }

    public void activarSuscripcion(Long barId, String tipo) throws Exception {
        Bar bar = barRepository.findById(barId).orElseThrow(() -> new Exception("Bar no encontrado"));
        bar.setTipoSuscripcion(tipo);
        bar.setActivo(true);
        bar.setFechaFinSuscripcion(tipo.equals("SUSCRIPCION_ANUAL") ? 
            java.time.LocalDate.now().plusYears(1) : java.time.LocalDate.now().plusMonths(1));
        barRepository.save(bar);
    }
}