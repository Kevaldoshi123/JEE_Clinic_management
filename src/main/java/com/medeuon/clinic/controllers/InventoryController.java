package com.medeuon.clinic.controllers;

import com.medeuon.clinic.models.InventoryItem;
import com.medeuon.clinic.repositories.InventoryRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/inventory")
public class InventoryController {

    @Autowired
    private InventoryRepository inventoryRepository;

    private Map<String, Object> mapItem(InventoryItem item) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", item.getId());
        m.put("name", item.getItemName());
        m.put("item_name", item.getItemName());
        m.put("itemName", item.getItemName());
        m.put("category", item.getCategory());
        m.put("dosage", item.getDosage());
        m.put("quantity", item.getQuantity());
        m.put("stock", item.getQuantity());
        m.put("min_threshold", item.getMinThreshold());
        m.put("minThreshold", item.getMinThreshold());
        m.put("unit_price", item.getUnitPrice());
        m.put("unitPrice", item.getUnitPrice());
        m.put("manufacturer", item.getManufacturer());
        m.put("batch_number", item.getBatchNumber());
        m.put("batchNumber", item.getBatchNumber());
        m.put("is_active", item.getIsActive());
        m.put("status", item.getQuantity() <= 0 ? "Out of Stock" : (item.getQuantity() <= item.getMinThreshold() ? "Low Stock" : "In Stock"));
        return m;
    }

    // Get All Inventory Items
    @GetMapping
    public ResponseEntity<?> getAllInventory() {
        List<InventoryItem> items = inventoryRepository.findByIsActiveTrueOrderByItemNameAsc();
        return ResponseEntity.ok(items.stream().map(this::mapItem).collect(Collectors.toList()));
    }

    // Prescription Items Autocomplete list
    @GetMapping("/prescription-items")
    public ResponseEntity<?> getPrescriptionItems(@RequestParam(required = false) String q) {
        List<InventoryItem> items;
        if (q != null && !q.trim().isEmpty()) {
            items = inventoryRepository.findByItemNameContainingIgnoreCaseAndIsActiveTrue(q.trim());
        } else {
            items = inventoryRepository.findByIsActiveTrueOrderByItemNameAsc();
        }
        return ResponseEntity.ok(items.stream().map(this::mapItem).collect(Collectors.toList()));
    }

    // Update Inventory Item Quantity or Details
    @PostMapping("/update")
    public ResponseEntity<?> updateInventoryItem(@RequestBody Map<String, Object> payload) {
        Long id = payload.get("id") != null ? ((Number) payload.get("id")).longValue() : null;
        String name = (String) payload.getOrDefault("name", payload.get("item_name"));
        Integer qty = payload.get("quantity") != null ? ((Number) payload.get("quantity")).intValue() : 50;

        InventoryItem item;
        if (id != null) {
            Optional<InventoryItem> opt = inventoryRepository.findById(id);
            if (opt.isPresent()) {
                item = opt.get();
                if (payload.containsKey("quantity")) item.setQuantity(qty);
                if (payload.containsKey("unit_price")) item.setUnitPrice(BigDecimal.valueOf(((Number) payload.get("unit_price")).doubleValue()));
                item.setUpdatedAt(LocalDateTime.now());
                inventoryRepository.save(item);
                return ResponseEntity.ok(Map.of("message", "Inventory item updated successfully!", "item", mapItem(item)));
            }
        }

        // New Item
        item = InventoryItem.builder()
                .itemName(name != null ? name : "Medicine")
                .category((String) payload.getOrDefault("category", "Tablet"))
                .dosage((String) payload.getOrDefault("dosage", "500mg"))
                .quantity(qty)
                .minThreshold(20)
                .unitPrice(payload.get("unit_price") != null ? BigDecimal.valueOf(((Number) payload.get("unit_price")).doubleValue()) : BigDecimal.valueOf(25.00))
                .manufacturer((String) payload.getOrDefault("manufacturer", "CareCore Pharma"))
                .batchNumber((String) payload.getOrDefault("batch_number", "BAT-2026"))
                .isActive(true)
                .updatedAt(LocalDateTime.now())
                .build();

        inventoryRepository.save(item);
        return ResponseEntity.ok(Map.of("message", "Item added to inventory!", "item", mapItem(item)));
    }
}
