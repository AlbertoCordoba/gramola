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