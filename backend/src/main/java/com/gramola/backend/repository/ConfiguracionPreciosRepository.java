package com.gramola.backend.repository;

import com.gramola.backend.model.ConfiguracionPrecios;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface ConfiguracionPreciosRepository extends JpaRepository<ConfiguracionPrecios, Long> {
    // Buscamos por el campo 'clave' de la entidad Java
    Optional<ConfiguracionPrecios> findByClave(String clave);
}