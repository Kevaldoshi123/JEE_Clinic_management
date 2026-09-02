package com.medeuon.clinic.models;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "doctors")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Doctor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "full_name", nullable = false, length = 100)
    private String fullName;

    @Column(nullable = false, unique = true, length = 100)
    private String email;

    @Column(nullable = false, length = 20)
    private String phone;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(nullable = false, length = 100)
    private String specialization;

    @Column(nullable = false, length = 200)
    private String qualification;

    @Column(name = "registration_number", nullable = false, unique = true, length = 50)
    private String registrationNumber;

    @Column(name = "years_experience")
    private Integer yearsExperience = 0;

    @Column(name = "consultation_fee", nullable = false)
    private BigDecimal consultationFee = BigDecimal.valueOf(500.00);

    @Column(name = "profile_bio", columnDefinition = "TEXT")
    private String profileBio;

    @Column(name = "clinic_address", columnDefinition = "TEXT")
    private String clinicAddress;

    @Column(name = "profile_photo_url", length = 500)
    private String profilePhotoUrl;

    @Column(name = "approval_status", length = 20)
    private String approvalStatus = "pending"; // 'pending', 'approved', 'rejected', 'suspended'

    @Column(name = "is_service_active")
    private Boolean isServiceActive = true;

    // Wizard Additional Details
    @Column(length = 20)
    private String gender;

    @Column(name = "date_of_birth")
    private String dateOfBirth;

    @Column(name = "medical_license_url", length = 500)
    private String medicalLicenseUrl;

    @Column(name = "degree_url", length = 500)
    private String degreeUrl;

    @Column(name = "medical_council", length = 150)
    private String medicalCouncil;

    @Column(length = 150)
    private String hospital;

    @Column(length = 100)
    private String department;

    @Column(name = "languages_spoken", length = 250)
    private String languagesSpoken;

    @Column(name = "available_days", length = 250)
    private String availableDays;

    @Column(name = "working_hours", length = 100)
    private String workingHours;

    @Column(name = "slot_duration")
    private Integer slotDuration = 15;

    @Column(name = "is_online_available")
    private Boolean isOnlineAvailable = true;

    @Column(name = "is_offline_available")
    private Boolean isOfflineAvailable = true;

    @Column(name = "is_emergency_available")
    private Boolean isEmergencyAvailable = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by")
    private Admin approvedBy;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "last_login")
    private LocalDateTime lastLogin;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        if (this.isActive == null) this.isActive = true;
        if (this.isServiceActive == null) this.isServiceActive = true;
        if (this.approvalStatus == null) this.approvalStatus = "pending";
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
