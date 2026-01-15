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