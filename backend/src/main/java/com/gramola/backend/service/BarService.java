package com.gramola.backend.service;

import com.gramola.backend.dto.BarLoginDTO;     // Importante: para el login
import com.gramola.backend.dto.BarRegistroDTO;  // Importante: para el registro
import com.gramola.backend.model.Bar;
import com.gramola.backend.repository.BarRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class BarService {

    @Autowired
    private BarRepository barRepository;

    // --- FUNCIONALIDAD 1: REGISTRO (Ya la tenías) ---
    public Bar registrarBar(BarRegistroDTO datos) throws Exception {
        // 1. Comprobar si el email ya existe
        if (barRepository.existsByEmail(datos.getEmail())) {
            throw new Exception("El email ya está registrado");
        }

        // 2. Comprobar si las contraseñas coinciden
        if (!datos.getPassword().equals(datos.getConfirmPassword())) {
            throw new Exception("Las contraseñas no coinciden");
        }

        // 3. Crear la entidad Bar
        Bar bar = new Bar();
        bar.setNombre(datos.getNombre());
        bar.setEmail(datos.getEmail());
        bar.setPassword(datos.getPassword()); // TODO: Más adelante encriptaremos esto
        
        // Puntos extra: Coordenadas
        bar.setLatitud(datos.getLatitud());
        bar.setLongitud(datos.getLongitud());
        
        // Generar token para el email
        bar.setTokenConfirmacion(UUID.randomUUID().toString());
        bar.setActivo(false); // No activo hasta que confirme email

        // 4. Guardar en Base de Datos
        return barRepository.save(bar);
        
        // TODO: Aquí llamaremos al servicio de Email más adelante
    }

    // --- FUNCIONALIDAD 2: LOGIN (Nueva) ---
    // Este método gestiona la entrada del usuario comprobando email y contraseña
    public Bar login(BarLoginDTO datos) throws Exception {
        // 1. Buscamos el bar por su email
        // .orElseThrow lanza una excepción si el usuario no existe en la base de datos
        Bar bar = barRepository.findByEmail(datos.getEmail())
                .orElseThrow(() -> new Exception("Usuario no encontrado"));

        // 2. Comprobamos si la contraseña coincide (comparación simple por ahora)
        if (!bar.getPassword().equals(datos.getPassword())) {
            throw new Exception("Contraseña incorrecta");
        }

        // 3. Si todo va bien, devolvemos el usuario completo
        return bar;
    }
    
}