package com.medeuon.clinic.models;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "queue_state", uniqueConstraints = {
    @UniqueConstraint(name = "unique_queue", columnNames = {"queue_date", "doctor_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QueueState {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "queue_date", nullable = false)
    private LocalDate queueDate;

    @Column(name = "doctor_id", nullable = false)
    private Long doctorId = 1L;

    @Column(name = "current_number")
    private Integer currentNumber = 0;

    @Column(name = "last_action", length = 50)
    private String lastAction = "next"; // next, skip, recall

    @Column(name = "action_ts")
    private Long actionTs = 0L;

    @Column(name = "last_token")
    private Integer lastToken = 0;

    @Column(name = "reset_at")
    private LocalDateTime resetAt;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        if (this.currentNumber == null) this.currentNumber = 0;
        if (this.lastToken == null) this.lastToken = 0;
        if (this.lastAction == null) this.lastAction = "next";
        if (this.actionTs == null) this.actionTs = 0L;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
