package com.medeuon.clinic.repositories;

import com.medeuon.clinic.models.InventoryItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InventoryRepository extends JpaRepository<InventoryItem, Long> {
    List<InventoryItem> findByIsActiveTrueOrderByItemNameAsc();
    List<InventoryItem> findByItemNameContainingIgnoreCaseAndIsActiveTrue(String name);
}
