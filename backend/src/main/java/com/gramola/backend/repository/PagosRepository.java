/*
 * ======================================================================================
 * RESUMEN
 * ======================================================================================
 * * ¿QUÉ ES ESTA CLASE?
 * Repositorio encargado de persistir el historial financiero (la tabla 'Pagos').
 *
 * * PUNTOS CLAVE (HERENCIA Y EFICIENCIA):
 * 1. ¿POR QUÉ ESTÁ VACÍA?
 * No es un error. Al extender de 'JpaRepository<Pagos, Long>', esta interfaz
 * HEREDA automáticamente más de 15 métodos estándar para gestionar datos:
 * - save(pago): Para guardar una transacción.
 * - findAll(): Para listar todos los pagos (para reportes).
 * - findById(id): Para buscar un pago concreto.
 * - count(): Para saber cuántos pagos se han realizado.
 *
 * 2. PRINCIPIO KISS (Keep It Simple, Stupid):
 * Como la lógica de negocio actual solo requiere guardar pagos (insert) y no
 * necesitamos búsquedas complejas (como "buscar pagos por fecha y monto mayor a X"),
 * no ensuciamos el código con métodos que no se usan. Si en el futuro hacen falta,
 * se añaden aquí.
 * ======================================================================================
 */

package com.gramola.backend.repository;

import com.gramola.backend.model.Pagos;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PagosRepository extends JpaRepository<Pagos, Long> {
    // ESTA INTERFAZ HEREDA TODOS LOS MÉTODOS CRUD ESTÁNDAR.
    // No es necesario declarar nada más para poder guardar y leer pagos.
}