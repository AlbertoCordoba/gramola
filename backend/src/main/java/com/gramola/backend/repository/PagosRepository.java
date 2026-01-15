package com.gramola.backend.repository;

import com.gramola.backend.model.Pagos;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PagosRepository extends JpaRepository<Pagos, Long> {
    // ESTA INTERFAZ HEREDA TODOS LOS MÉTODOS CRUD ESTÁNDAR.
    // No es necesario declarar nada más para poder guardar y leer pagos.
}