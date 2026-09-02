package com.medeuon.clinic.models;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "bills")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Bill {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "patient_id")
    private Long patientId;

    @Column(name = "patient_name", length = 100)
    private String patientName;

    @Column(name = "doctor_id")
    private Long doctorId;

    @Column(name = "doctor_name", length = 100)
    private String doctorName;

    @Column(name = "token_number")
    private Integer tokenNumber;

    @Column(name = "amount", precision = 10, scale = 2, nullable = false)
    private BigDecimal amount;

    @Builder.Default
    @Column(name = "payment_status", length = 20)
    private String paymentStatus = "pending"; // 'pending', 'paid', 'cancelled'

    @Column(name = "payment_method", length = 50)
    private String paymentMethod; // 'cash', 'upi', 'card'

    @Column(name = "description", length = 255)
    private String description;

    @Builder.Default
    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "paid_at")
    private LocalDateTime paidAt;
}
