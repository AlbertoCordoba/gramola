/*
 * ======================================================================================
 * RESUMEN
 * ======================================================================================
 * * ¿QUÉ ES ESTA CLASE?
 * Gestiona el acceso a la tabla de canciones. Aquí reside la lógica de ordenamiento
 * de la Gramola.
 *
 * * PUNTOS CLAVE (LÓGICA DE NEGOCIO EN BD):
 * 1. COLA DE REPRODUCCIÓN (FIFO - First In, First Out):
 * El método para obtener la cola ordena por 'FechaSolicitud ASC' (Ascendente).
 * Esto garantiza que la canción que se pidió primero, suene primero. Es lo justo.
 *
 * 2. HISTORIAL (LIFO - Last In, First Out):
 * El método para el historial ordena por 'FechaSolicitud DESC' (Descendente) y usa
 * 'Top5' para limitar resultados. Así mostramos las últimas canciones que sonaron,
 * no las de hace 3 años.
 * ======================================================================================
 */

package com.gramola.backend.repository;

import com.gramola.backend.model.CancionSolicitada;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CancionSolicitadaRepository extends JpaRepository<CancionSolicitada, Long> {

    /*
     * MÉTODOS DERIVADOS (Query Creation from Method Names):
     * Spring analiza el nombre del método y crea la query.
     */

    // PARA LA COLA (Próximas canciones):
    // Filtra por Bar + Estado ("COLA") + Ordena por Antigüedad (Lo viejo primero)
    List<CancionSolicitada> findByBarIdAndEstadoOrderByFechaSolicitudAsc(Long barId, String estado);

    // PARA EL HISTORIAL (Ya sonaron):
    // Filtra por Bar + Estado ("TERMINADA") + Ordena por Novedad (Lo nuevo primero)
    // 'Top5' limita la respuesta a solo 5 registros para no saturar la interfaz.
    List<CancionSolicitada> findTop5ByBarIdAndEstadoOrderByFechaSolicitudDesc(Long barId, String estado);
}