/*
 * ======================================================================================
 * RESUMEN
 * ======================================================================================
 * * ¿QUÉ ES ESTA CLASE?
 * Es el mecanismo de acceso a datos para la tabla de configuración de precios.
 *
 * * PUNTOS CLAVE:
 * 1. BÚSQUEDA SEMÁNTICA (Query Method):
 * El método 'findByClave' es un ejemplo de la potencia de Spring Data JPA.
 * No necesitamos escribir SQL ("SELECT * FROM..."). Simplemente nombrando el método
 * como 'findBy' + 'NombreDelCampo', el framework genera la consulta automáticamente
 * al arrancar la aplicación.
 *
 * 2. SEGURIDAD CON OPTIONAL:
 * Devolvemos un 'Optional<ConfiguracionPrecios>' en lugar del objeto directo.
 * Esto obliga a quien use este método (el Servicio) a comprobar si el precio existe
 * antes de usarlo, evitando excepciones 'NullPointerException' que podrían tumbar el servidor.
 *
 * 3. DESACOPLAMIENTO:
 * Al usar una interfaz, si mañana cambiamos la base de datos de MySQL a PostgreSQL,
 * no tenemos que cambiar ni una línea de este código.
 * ======================================================================================
 */

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