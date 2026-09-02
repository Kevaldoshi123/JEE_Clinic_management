package com.medeuon.clinic.models;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "tokens", indexes = {
    @Index(name = "idx_token_date", columnList = "token_date"),
    @Index(name = "idx_status", columnList = "status"),
    @Index(name = "idx_doctor_date", columnList = "doctor_id, token_date"),
    @Index(name = "idx_token_number", columnList = "token_number, token_date"),
    @Index(name = "idx_tokens_patient_date", columnList = "patient_id, token_date")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Token {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "token_number", nullable = false)
    private Integer tokenNumber;

    @Column(name = "token_date", nullable = false)
    private LocalDate tokenDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "doctor_id", nullable = false)
    private Doctor doctor;

    @Column(length = 20)
    private String status = "waiting"; // 'waiting', 'called', 'in_progress', 'completed', 'skipped', 'cancelled'

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "called_at")
    private LocalDateTime calledAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        if (this.status == null) {
            this.status = "waiting";
        }
    }
}
