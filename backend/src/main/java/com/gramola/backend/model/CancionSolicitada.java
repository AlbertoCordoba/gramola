/*
 * ======================================================================================
 * RESUMEN
 * ======================================================================================
 * * ¿QUÉ ES ESTA CLASE?
 * La clase 'CancionSolicitada' es la unidad de información fundamental de la Gramola.
 * Cada instancia representa una petición de música realizada por un cliente que ha pagado.
 *
 * * PUNTOS CLAVE:
 * 1. DOBLE FUNCIÓN (COLA E HISTORIAL):
 * Esta misma tabla sirve para dos cosas dependiendo del campo 'estado':
 * - Si estado="COLA" -> Es la lista de reproducción pendiente (FIFO).
 * - Si estado="TERMINADA" -> Es el historial de lo que ha sonado (LIFO).
 *
 * 2. INDEPENDENCIA DE SPOTIFY (CACHÉ):
 * Aunque la música suena por Spotify, guardamos aquí el título, artista e imagen.
 * ¿Por qué? Para que la interfaz (el Frontend) cargue instantáneamente la lista
 * sin tener que hacer 50 peticiones a la API de Spotify cada vez que alguien entra.
 *
 * 3. OPTIMIZACIÓN DE RELACIONES:
 * Usamos 'barId' (Long) en lugar de un objeto 'Bar' completo para evitar cargas
 * pesadas de base de datos, ya que esta tabla tendrá miles de registros.
 *
 * 4. AUDITORÍA AUTOMÁTICA:
 * Usamos el mecanismo '@PrePersist' para garantizar que el momento exacto de la
 * solicitud quede registrado automáticamente sin intervención manual.
 * ======================================================================================
 */

package com.gramola.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/*
 * @Data (Lombok):
 * Genera getters, setters, toString, etc. automáticamente.
 * Mantiene la clase limpia, actuando como un POJO (Plain Old Java Object) puro.
 */
@Data

/*
 * @Entity y @Table:
 * Mapean esta clase Java a la tabla física "canciones_solicitadas" en MySQL.
 */
@Entity
@Table(name = "canciones_solicitadas")
public class CancionSolicitada {

    // --- IDENTIFICADOR ---
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // --- RELACIÓN CON EL NEGOCIO ---
    /*
     * NOTA DEFENSA: Guardamos solo el ID del bar ('barId') y no el objeto 'Bar'
     * completo (@ManyToOne) por RENDIMIENTO.
     * Al listar la cola, no necesitamos traer todos los datos del dueño del bar
     * (password, tokens, etc.), solo necesitamos filtrar por su ID.
     */
    @Column(name = "bar_id")
    private Long barId;

    // --- DATOS DE SPOTIFY ---
    // El ID único de la canción en Spotify (ej. "6rqhFgbbKwnb9MLmUQDhG6").
    // Es lo que enviamos a la API de Spotify para decirle "reproduce esto".
    @Column(name = "spotify_id")
    private String spotifyId;

    // --- CACHÉ DE METADATOS ---
    // Guardamos estos datos en NUESTRA base de datos para no depender de Spotify
    // para pintar la pantalla de la Gramola. Esto hace la app mucho más rápida.
    private String titulo;
    private String artista;

    @Column(name = "imagen_url")
    private String imagenUrl; // URL de la portada del álbum para mostrarla en pantalla.

    @Column(name = "duracion_ms")
    private Integer duracionMs; // Necesario para calcular la barra de progreso en el cliente.

    // --- GESTIÓN DE ESTADO (Máquina de Estados) ---
    /*
     * Controla el ciclo de vida de la petición. Valores:
     * - "COLA": El cliente pagó, está esperando su turno.
     * - "SONANDO": Es la canción actual.
     * - "TERMINADA": Ya sonó, pasa al historial visual.
     */
    private String estado;

    // --- AUDITORÍA ---
    @Column(name = "fecha_solicitud")
    private LocalDateTime fechaSolicitud;

    /*
     * @PrePersist:
     * Este método es un "Hook" de JPA. Se ejecuta AUTOMÁTICAMENTE justo antes
     * de hacer el INSERT en la base de datos.
     * Asegura que nunca se guarde una canción sin fecha.
     */
    @PrePersist
    protected void onCreate() {
        fechaSolicitud = LocalDateTime.now();
    }
}