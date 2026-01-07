package com.gramola.backend.repository;

import com.gramola.backend.model.StripeTransaction;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StripeTransactionRepository extends JpaRepository<StripeTransaction, String> {
}