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
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
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
    private PagosRepository pagosRepository;
    
    // Herramienta estándar de seguridad para encriptar claves
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
        
        // ENCRIPTACIÓN: Clave del éxito en seguridad
        String passwordEncriptada = passwordEncoder.encode(datos.getPassword());
        bar.setPassword(passwordEncriptada); 
        
        bar.setLatitud(datos.getLatitud());
        bar.setLongitud(datos.getLongitud());
        
        // DECODIFICACIÓN DE IMAGEN: Transformamos el String Base64 del Canvas HTML a Bytes
        if (datos.getFirmaBase64() != null && !datos.getFirmaBase64().isEmpty()) {
            try {
                // Quitamos la cabecera "data:image/png;base64," para quedarnos con los datos puros
                String base64Image = datos.getFirmaBase64().split(",")[1];
                byte[] imageBytes = Base64.getDecoder().decode(base64Image);
                bar.setFirmaImagen(imageBytes);
            } catch (Exception e) {
                System.err.println("Error guardando firma: " + e.getMessage());
            }
        }
        
        // Generamos token para validar el email
        String token = UUID.randomUUID().toString();
        bar.setTokenConfirmacion(token);
        bar.setActivo(false); // Inactivo por defecto hasta que pague y confirme

        barRepository.save(bar);
        
        // Enviamos el correo asíncronamente (delegado en EmailService)
        emailService.sendWelcomeEmail(bar.getEmail(), token);
    }

    public void confirmarCuenta(String token) throws Exception {
        Bar bar = barRepository.findByTokenConfirmacion(token)
                .orElseThrow(() -> new Exception("Token inválido"));
        bar.setTokenConfirmacion(null);
        barRepository.save(bar);
    }

    // --- LOGIN Y GEOLOCALIZACIÓN ---
    public Bar login(BarLoginDTO datos) throws Exception {
            Bar bar = barRepository.findByEmail(datos.getEmail())
                    .orElseThrow(() -> new Exception("Usuario no encontrado"));

            // Comprobamos la contraseña hasheada
            if (!passwordEncoder.matches(datos.getPassword(), bar.getPassword())) {
                throw new Exception("Contraseña incorrecta");
            }
            
            // Validaciones de estado de cuenta
            if (bar.getTokenConfirmacion() != null) throw new Exception("Confirma tu email primero.");
            if (!bar.isActivo()) throw new Exception("Completa el pago de suscripción.");
            
            // --- CONTROL GPS (Anti-Fraude) ---
            if (datos.getLat() == null || datos.getLng() == null) {
                throw new Exception("⚠️ Ubicación obligatoria. Activa el GPS para entrar.");
            }
            
            // Calculamos si el usuario está físicamente cerca del bar
            if (bar.getLatitud() != null && bar.getLongitud() != null) {
                double distancia = calcularDistancia(datos.getLat(), datos.getLng(), bar.getLatitud(), bar.getLongitud());
                
                // Límite de 100 metros
                if (distancia > 100) {
                    throw new Exception("⛔ Acceso denegado: Estás a " + (int)distancia + "m del bar (Máx 100m).");
                }
            }

            return bar;
        }

    // FÓRMULA DEL HAVERSINE: Matemática para calcular distancia entre dos puntos en una esfera (La Tierra)
    private double calcularDistancia(double lat1, double lon1, double lat2, double lon2) {
        final int R = 6371; // Radio de la Tierra en km
        double latDistance = Math.toRadians(lat2 - lat1);
        double lonDistance = Math.toRadians(lon2 - lon1);
        double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return (R * c) * 1000; // Convertimos a metros
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
        bar.setPassword(passwordEncoder.encode(newPassword));
        
        bar.setResetPasswordToken(null);
        bar.setResetPasswordExpires(null);
        barRepository.save(bar);
    }

    // --- SUSCRIPCIONES Y PAGOS ---
    // NOTA: 'simularError' ya no se usa porque el pago real se hace en el frontend con Stripe,
    // pero mantenemos el parámetro para no romper el BarController si no se ha actualizado.
    public void activarSuscripcion(String email, String tipo, boolean simularError) throws Exception {
        Bar bar = barRepository.findByEmail(email)
                .orElseThrow(() -> new Exception("Usuario no encontrado"));
        
        // --- CAMBIO PARA STRIPE ---
        // Eliminamos la llamada a MockPaymentService.
        // Asumimos que si se llama a este método, el pago en Stripe ya fue "succeeded" en el frontend.
        
        BigDecimal precioSuscripcion = preciosRepository.findByClave(tipo)
                .map(ConfiguracionPrecios::getValor)
                .orElse(BigDecimal.ZERO);

        // Auditoría financiera en nuestra base de datos local
        Pagos nuevoPago = new Pagos();
        nuevoPago.setBarId(bar.getId());
        nuevoPago.setConcepto("Suscripción (Stripe): " + tipo);
        nuevoPago.setMonto(precioSuscripcion);
        nuevoPago.setFechaPago(LocalDateTime.now());
        pagosRepository.save(nuevoPago);

        // Activamos al usuario y calculamos fecha fin
        bar.setTipoSuscripcion(tipo);
        bar.setActivo(true);
        bar.setFechaFinSuscripcion(tipo.equals("SUSCRIPCION_ANUAL") ? 
            java.time.LocalDate.now().plusYears(1) : java.time.LocalDate.now().plusMonths(1));
        
        barRepository.save(bar);
    }
}