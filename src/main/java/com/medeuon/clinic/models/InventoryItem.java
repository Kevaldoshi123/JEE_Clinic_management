package com.medeuon.clinic.models;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "inventory_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InventoryItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "item_name", nullable = false, length = 150)
    private String itemName;

    @Column(name = "category", length = 50)
    private String category; // 'Tablet', 'Syrup', 'Injection', 'Ointment', 'Consumable'

    @Column(name = "dosage", length = 50)
    private String dosage; // '500mg', '10ml', '5mg'

    @Builder.Default
    @Column(name = "quantity")
    private Integer quantity = 100;

    @Builder.Default
    @Column(name = "min_threshold")
    private Integer minThreshold = 20;

    @Column(name = "unit_price", precision = 10, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "manufacturer", length = 100)
    private String manufacturer;

    @Column(name = "batch_number", length = 50)
    private String batchNumber;

    @Builder.Default
    @Column(name = "is_active")
    private Boolean isActive = true;

    @Builder.Default
    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();
}
