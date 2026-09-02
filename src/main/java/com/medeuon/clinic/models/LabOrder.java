package com.medeuon.clinic.models;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "lab_orders")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LabOrder {

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

    @Column(name = "test_name", nullable = false, length = 150)
    private String testName;

    @Column(name = "category", length = 100)
    private String category; // 'Pathology', 'Radiology', 'Cardiology', 'Biochemistry'

    @Builder.Default
    @Column(name = "priority", length = 20)
    private String priority = "normal"; // 'normal', 'urgent', 'stat'

    @Builder.Default
    @Column(name = "status", length = 20)
    private String status = "pending"; // 'pending', 'sample_collected', 'in_analysis', 'completed'

    @Column(name = "report_url", length = 500)
    private String reportUrl;

    @Column(name = "clinical_notes", columnDefinition = "TEXT")
    private String clinicalNotes;

    @Builder.Default
    @Column(name = "ordered_at")
    private LocalDateTime orderedAt = LocalDateTime.now();

    @Column(name = "completed_at")
    private LocalDateTime completedAt;
}
