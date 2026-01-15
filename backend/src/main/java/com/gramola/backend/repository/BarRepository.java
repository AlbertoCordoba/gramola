package com.gramola.backend.repository;

import com.gramola.backend.model.Bar;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

/*
 * @Repository:
 * Marca esta interfaz como un componente de acceso a datos. Spring la detecta
 * y crea una implementación en memoria automáticamente.
 * Extiende JpaRepository<Entidad, TipoID> para heredar métodos CRUD básicos (save, delete, findById...).
 */
@Repository
public interface BarRepository extends JpaRepository<Bar, Long> {

    // Genera: SELECT * FROM bares WHERE email = ?
    Optional<Bar> findByEmail(String email);

    // Genera: SELECT COUNT(*) > 0 FROM bares WHERE email = ?
    // Muy eficiente para validaciones en el registro (evitar duplicados).
    boolean existsByEmail(String email);

    // Búsqueda por token de confirmación (para activar la cuenta)
    Optional<Bar> findByTokenConfirmacion(String token);

    // Búsqueda por token de recuperación de contraseña
    Optional<Bar> findByResetPasswordToken(String token);
}