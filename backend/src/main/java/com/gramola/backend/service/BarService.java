package com.gramola.backend.service;

import com.gramola.backend.dto.BarLoginDTO;
import com.gramola.backend.dto.BarRegistroDTO;
import com.gramola.backend.model.Bar;
import com.gramola.backend.model.ConfiguracionPrecios;
import com.gramola.backend.model.Pagos;
import com.gramola.backend.repository.BarRepository;
import com.gramola.backend.repository.ConfiguracionPreciosRepository;
import com.gramola.backend.repository.PagosRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder; // 1. IMPORTAR BCRYPT
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Base64;
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
    @Autowired
    private MockPaymentService paymentService;
    @Autowired
    private PagosRepository pagosRepository;

    // 2. CREAR INSTANCIA DEL ENCRIPTADOR
    // BCrypt es el estándar actual: seguro y lento (para evitar ataques de fuerza bruta)
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public Map<String, BigDecimal> obtenerPrecios() {
        Map<String, BigDecimal> precios = new HashMap<>();
        List<ConfiguracionPrecios> lista = preciosRepository.findAll();
        for (ConfiguracionPrecios p : lista) {
            String clave = p.getClave() != null ? p.getClave().trim() : "SIN_CLAVE";
            if (p.getClave() != null) precios.put(clave, p.getValor());
        }
        return precios;
    }

    public void registrarBar(BarRegistroDTO datos) throws Exception {
        if (barRepository.existsByEmail(datos.getEmail())) throw new Exception("El email ya existe");
        if (!datos.getPassword().equals(datos.getConfirmPassword())) throw new Exception("Las contraseñas no coinciden");

        Bar bar = new Bar();
        bar.setNombre(datos.getNombre());
        bar.setEmail(datos.getEmail());
        
        // 3. ENCRIPTAR AL REGISTRAR
        // Nunca guardamos datos.getPassword() directo. Guardamos el hash.
        String passwordEncriptada = passwordEncoder.encode(datos.getPassword());
        bar.setPassword(passwordEncriptada); 
        
        bar.setLatitud(datos.getLatitud());
        bar.setLongitud(datos.getLongitud());
        
        if (datos.getFirmaBase64() != null && !datos.getFirmaBase64().isEmpty()) {
            try {
                String base64Image = datos.getFirmaBase64().split(",")[1];
                byte[] imageBytes = Base64.getDecoder().decode(base64Image);
                bar.setFirmaImagen(imageBytes);
            } catch (Exception e) {
                System.err.println("Error guardando firma: " + e.getMessage());
            }
        }
        
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

        // 4. COMPARAR AL HACER LOGIN
        // No podemos comparar textos planos. Usamos .matches(textoPlano, hashGuardado)
        if (!passwordEncoder.matches(datos.getPassword(), bar.getPassword())) {
            throw new Exception("Contraseña incorrecta");
        }

        if (bar.getTokenConfirmacion() != null) throw new Exception("Confirma tu email primero.");
        if (!bar.isActivo()) throw new Exception("Completa el pago de suscripción.");

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

        // 5. ENCRIPTAR TAMBIÉN AL RESTABLECER
        bar.setPassword(passwordEncoder.encode(newPassword));
        
        bar.setResetPasswordToken(null);
        bar.setResetPasswordExpires(null);
        barRepository.save(bar);
    }

    public void activarSuscripcion(String email, String tipo, boolean simularError) throws Exception {
        Bar bar = barRepository.findByEmail(email).orElseThrow(() -> new Exception("Usuario no encontrado"));
        
        paymentService.procesarPago(simularError);

        BigDecimal precioSuscripcion = preciosRepository.findByClave(tipo)
                .map(ConfiguracionPrecios::getValor)
                .orElse(BigDecimal.ZERO);

        Pagos nuevoPago = new Pagos();
        nuevoPago.setBarId(bar.getId());
        nuevoPago.setConcepto("Suscripción: " + tipo);
        nuevoPago.setMonto(precioSuscripcion);
        nuevoPago.setFechaPago(LocalDateTime.now());
        pagosRepository.save(nuevoPago);

        bar.setTipoSuscripcion(tipo);
        bar.setActivo(true);
        bar.setFechaFinSuscripcion(tipo.equals("SUSCRIPCION_ANUAL") ? 
            java.time.LocalDate.now().plusYears(1) : java.time.LocalDate.now().plusMonths(1));
        
        barRepository.save(bar);
    }
}