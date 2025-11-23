package com.gramola.backend.repository;

import com.gramola.backend.model.Bar;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface BarRepository extends JpaRepository<Bar, Long> {
    // Spring crea automáticamente el SQL para esto basándose en el nombre del método:
    Optional<Bar> findByEmail(String email);
    
    boolean existsByEmail(String email);
}