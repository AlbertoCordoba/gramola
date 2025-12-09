package com.gramola.backend.repository;

import com.gramola.backend.model.Bar;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface BarRepository extends JpaRepository<Bar, Long> {
    Optional<Bar> findByEmail(String email);
    boolean existsByEmail(String email);
    Optional<Bar> findByTokenConfirmacion(String token);
    Optional<Bar> findByResetPasswordToken(String token);
}