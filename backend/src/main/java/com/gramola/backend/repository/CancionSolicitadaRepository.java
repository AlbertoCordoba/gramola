package com.gramola.backend.repository;

import com.gramola.backend.model.CancionSolicitada;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CancionSolicitadaRepository extends JpaRepository<CancionSolicitada, Long> {
    // Cola de reproducción (FIFO)
    List<CancionSolicitada> findByBarIdAndEstadoOrderByFechaSolicitudAsc(Long barId, String estado);

    // Historial de pagos (LIFO - Las últimas 5)
    List<CancionSolicitada> findTop5ByBarIdAndEstadoOrderByFechaSolicitudDesc(Long barId, String estado);
}