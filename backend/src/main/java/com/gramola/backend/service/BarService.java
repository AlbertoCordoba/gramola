/*
 * ======================================================================================
 * RESUMEN
 * ======================================================================================
 * * ¿QUÉ ES ESTA CLASE?
 * 'BarService' gestiona todo el ciclo de vida del usuario (el dueño del local).
 * Es responsable de la seguridad, el acceso y la monetización de la plataforma.
 *
 * * PUNTOS CLAVE:
 * 1. SEGURIDAD (BCrypt):
 * Las contraseñas NUNCA se guardan en texto plano. Usamos 'BCryptPasswordEncoder'
 * para hashearlas antes de guardarlas en la base de datos.
 *
 * 2. GEOLOCALIZACIÓN (Fórmula del Haversine):
 * En el método 'login', implementamos un algoritmo matemático para calcular la
 * distancia entre el usuario y el bar. Si está a más de 100 metros, denegamos
 * el acceso. Esto es vital para evitar el uso fraudulento de la app.
 *
 * 3. DOBLE FACTOR DE ACTIVACIÓN:
 * Un usuario no puede entrar solo con registrarse. Implementamos un flujo de:
 * Registro -> Confirmación Email -> Pago Suscripción -> Cuenta Activa.
 *
 * 4. GESTIÓN DE FIRMAS (Base64):
 * Convertimos la firma digital que llega como String en Base64 desde el frontend
 * a un array de bytes (byte[]) para almacenarla eficientemente como BLOB.
 * ======================================================================================
 */

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
    public void activarSuscripcion(String email, String tipo, boolean simularError) throws Exception {
        Bar bar = barRepository.findByEmail(email).orElseThrow(() -> new Exception("Usuario no encontrado"));
        
        // Procesamos el pago primero
        paymentService.procesarPago(simularError);

        BigDecimal precioSuscripcion = preciosRepository.findByClave(tipo)
                .map(ConfiguracionPrecios::getValor)
                .orElse(BigDecimal.ZERO);

        // Auditoría financiera
        Pagos nuevoPago = new Pagos();
        nuevoPago.setBarId(bar.getId());
        nuevoPago.setConcepto("Suscripción: " + tipo);
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