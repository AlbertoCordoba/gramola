package com.gramola.backend.repository;

import com.gramola.backend.model.CancionSolicitada;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CancionSolicitadaRepository extends JpaRepository<CancionSolicitada, Long> {
    // Devuelve la cola ordenada por hora de llegada (FIFO)
    List<CancionSolicitada> findByBarIdAndEstadoOrderByFechaSolicitudAsc(Long barId, String estado);
}