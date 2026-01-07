/*
 * ======================================================================================
 * RESUMEN
 * ======================================================================================
 * * ¿QUÉ ES ESTA CLASE?
 * 'BackendApplication' es el punto de entrada (Entry Point) de la aplicación Spring Boot.
 * Es la clase que contiene el método 'main', igual que cualquier programa Java estándar.
 *
 * * PUNTOS CLAVE:
 * 1. ARRANQUE DEL SERVIDOR:
 * Al ejecutar esta clase, Spring Boot levanta un servidor web Apache Tomcat embebido
 * en el puerto 8080, inicializa la conexión a la base de datos y carga todos los
 * componentes (Controladores, Servicios, Repositorios) en memoria.
 *
 * 2. AUTOCONFIGURACIÓN MÁGICA (@SpringBootApplication):
 * Esta sola anotación hace el trabajo de tres:
 * - @Configuration: Permite declarar beans extra.
 * - @EnableAutoConfiguration: Configura Spring basándose en las librerías que ve (MySQL, Web, etc.).
 * - @ComponentScan: Busca automáticamente mis clases en el paquete 'com.gramola.backend'.
 * ======================================================================================
 */

package com.gramola.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/*
 * @SpringBootApplication:
 * La anotación "madre". Le dice a Java: "Esto no es una clase normal, es una app Web Spring Boot".
 * Activa el escaneo de componentes para encontrar tus Servicios y Controladores.
 */
@SpringBootApplication
public class BackendApplication {

	public static void main(String[] args) {
		// Esta línea lanza todo el framework.
		// Lee el archivo 'application.properties', conecta a MySQL y abre el puerto 8080.
		SpringApplication.run(BackendApplication.class, args);
	}

}