package com.gramola.backend.repository;

import com.gramola.backend.model.ConfiguracionPrecios;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

/*
 * @Repository:
 * Indica a Spring que esta interfaz es un componente de acceso a datos (DAO).
 * Spring creará una implementación en memoria de esta interfaz en tiempo de ejecución.
 */
@Repository
public interface ConfiguracionPreciosRepository extends JpaRepository<ConfiguracionPrecios, Long> {

    /*
     * MÉTODO MÁGICO (Derived Query Method):
     * Spring analiza el nombre: "findBy" + "Clave".
     * Automáticamente genera la query:
     * SELECT * FROM configuracion_precios WHERE clave = ?
     *
     * @param clave El identificador único (ej: "PRECIO_CANCION").
     * @return Optional vacío si no existe, o el objeto si lo encuentra.
     */
    Optional<ConfiguracionPrecios> findByClave(String clave);
}