/*
 * ======================================================================================
 * RESUMEN
 * ======================================================================================
 * * ¿QUÉ ES ESTA CLASE?
 * Es la configuración de seguridad de red para CORS (Cross-Origin Resource Sharing).
 *
 * * EL PROBLEMA:
 * Por defecto, los navegadores bloquean las peticiones entre dominios o puertos diferentes
 * por seguridad (para evitar que una web maliciosa lea datos de tu banco).
 * Aquí, Angular corre en el puerto 4200 y Spring Boot en el 8080. El navegador lo ve
 * como sitios distintos y bloquearía la conexión.
 *
 * * LA SOLUCIÓN:
 * Esta clase le dice explícitamente al navegador: "Confía en las peticiones que vengan
 * desde localhost:4200, permíteles usar GET, POST, PUT y leer las cookies/tokens".
 * ======================================================================================
 */

package com.gramola.backend;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/*
 * @Configuration: Marca la clase como fuente de configuración de Spring.
 * WebMvcConfigurer: Interfaz para personalizar el comportamiento del servidor Web.
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**") // Aplica la regla a TODOS los endpoints de la API
                .allowedOrigins("http://localhost:4200", // Permite Angular (Desarrollo)
                                "http://localhost:52693", // Puertos dinámicos (útil para pruebas)
                                "http://127.0.0.1:8080", 
                                "http://127.0.0.1:4200", 
                                "http://127.0.0.1:52693")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS") // Verbos HTTP permitidos
                .allowedHeaders("*") // Permite cualquier cabecera (Tokens, Auth, Content-Type)
                .allowCredentials(true); // Permite enviar cookies o credenciales en la petición
    }
}