package com.medeuon.clinic.controllers;

import com.medeuon.clinic.models.*;
import com.medeuon.clinic.repositories.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    @Autowired
    private DoctorRepository doctorRepository;

    @Autowired
    private PatientRepository patientRepository;

    @Autowired
    private TokenRepository tokenRepository;

    @Autowired
    private AppointmentRepository appointmentRepository;

    private Map<String, Object> mapDoctor(Doctor d) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", d.getId());
        m.put("full_name", d.getFullName());
        m.put("fullName", d.getFullName());
        m.put("email", d.getEmail());
        m.put("phone", d.getPhone());
        m.put("specialization", d.getSpecialization());
        m.put("qualification", d.getQualification());
        m.put("registration_number", d.getRegistrationNumber());
        m.put("registrationNumber", d.getRegistrationNumber());
        m.put("years_experience", d.getYearsExperience());
        m.put("yearsExperience", d.getYearsExperience());
        m.put("consultation_fee", d.getConsultationFee());
        m.put("consultationFee", d.getConsultationFee());
        m.put("profile_bio", d.getProfileBio());
        m.put("profile_photo_url", d.getProfilePhotoUrl());
        m.put("profilePhotoUrl", d.getProfilePhotoUrl());
        m.put("clinic_address", d.getClinicAddress());
        m.put("approval_status", d.getApprovalStatus());
        m.put("approvalStatus", d.getApprovalStatus());
        m.put("is_active", d.getIsActive() != null && d.getIsActive());
        m.put("isActive", d.getIsActive() != null && d.getIsActive());
        m.put("is_service_active", d.getIsServiceActive() != null && d.getIsServiceActive());
        m.put("isServiceActive", d.getIsServiceActive() != null && d.getIsServiceActive());
        m.put("working_hours", d.getWorkingHours());
        m.put("available_days", d.getAvailableDays());
        return m;
    }

    private Map<String, Object> mapPatient(Patient p) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", p.getId());
        m.put("full_name", p.getFullName());
        m.put("fullName", p.getFullName());
        m.put("age", p.getAge());
        m.put("gender", p.getGender());
        m.put("contact", p.getContact());
        m.put("phone", p.getContact());
        m.put("email", p.getEmail());
        m.put("blood_group", p.getBloodGroup());
        m.put("bloodGroup", p.getBloodGroup());
        m.put("medical_history", p.getMedicalHistory());
        return m;
    }

    // Get Doctors (optionally filtered by ?status=pending)
    @GetMapping("/doctors")
    public ResponseEntity<?> getDoctors(@RequestParam(required = false) String status) {
        List<Doctor> docs;
        if (status != null && !status.trim().isEmpty()) {
            docs = doctorRepository.findByApprovalStatusAndIsActiveTrue(status.trim().toLowerCase());
        } else {
            docs = doctorRepository.findAll();
        }
        return ResponseEntity.ok(docs.stream().map(this::mapDoctor).collect(Collectors.toList()));
    }

    // Get Pending Doctor Registrations (Legacy Route)
    @GetMapping("/pending-doctors")
    public ResponseEntity<?> getPendingDoctors() {
        List<Doctor> docs = doctorRepository.findByApprovalStatusAndIsActiveTrue("pending");
        return ResponseEntity.ok(docs.stream().map(this::mapDoctor).collect(Collectors.toList()));
    }

    // Get All Patients for Admin Registry
    @GetMapping("/patients")
    public ResponseEntity<?> getPatients() {
        List<Patient> patients = patientRepository.findAll();
        return ResponseEntity.ok(patients.stream().map(this::mapPatient).collect(Collectors.toList()));
    }

    // Approve Doctor Registration (Supports both /doctors/{id}/approve and /approve-doctor/{id})
    @PostMapping({"/doctors/{id}/approve", "/approve-doctor/{id}"})
    public ResponseEntity<?> approveDoctor(@PathVariable Long id) {
        Optional<Doctor> docOpt = doctorRepository.findById(id);
        if (docOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Doctor not found"));
        }

        Doctor doctor = docOpt.get();
        doctor.setApprovalStatus("approved");
        doctor.setIsActive(true);
        doctor.setIsServiceActive(true);
        doctor.setApprovedAt(LocalDateTime.now());
        doctorRepository.save(doctor);

        return ResponseEntity.ok(Map.of("message", "Doctor " + doctor.getFullName() + " approved successfully!", "doctor", mapDoctor(doctor)));
    }

    // Suspend Doctor Service
    @PostMapping("/doctors/{id}/suspend")
    public ResponseEntity<?> suspendDoctor(@PathVariable Long id) {
        Optional<Doctor> docOpt = doctorRepository.findById(id);
        if (docOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Doctor not found"));
        }

        Doctor doctor = docOpt.get();
        doctor.setIsActive(false);
        doctor.setIsServiceActive(false);
        doctor.setApprovalStatus("suspended");
        doctorRepository.save(doctor);

        return ResponseEntity.ok(Map.of("message", "Doctor " + doctor.getFullName() + " suspended successfully!", "doctor", mapDoctor(doctor)));
    }

    // Reject Doctor Registration (Supports both /doctors/{id}/reject and /reject-doctor/{id})
    @PostMapping({"/doctors/{id}/reject", "/reject-doctor/{id}"})
    public ResponseEntity<?> rejectDoctor(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body) {
        Optional<Doctor> docOpt = doctorRepository.findById(id);
        if (docOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Doctor not found"));
        }

        Doctor doctor = docOpt.get();
        doctor.setApprovalStatus("rejected");
        doctor.setIsActive(false);
        doctor.setIsServiceActive(false);
        if (body != null && body.containsKey("reason")) {
            doctor.setRejectionReason(body.get("reason"));
        }
        doctorRepository.save(doctor);

        return ResponseEntity.ok(Map.of("message", "Doctor application rejected."));
    }

    // Get Admin Dashboard Overview Metrics
    @GetMapping("/analytics")
    public ResponseEntity<?> getAnalytics() {
        long totalDoctors = doctorRepository.count();
        long totalPatients = patientRepository.count();
        long totalAppointments = appointmentRepository.count();
        long pendingApprovals = doctorRepository.findByApprovalStatusAndIsActiveTrue("pending").size();

        Map<String, Object> metrics = new HashMap<>();
        metrics.put("totalDoctors", totalDoctors);
        metrics.put("totalPatients", totalPatients);
        metrics.put("totalAppointments", totalAppointments);
        metrics.put("pendingApprovals", pendingApprovals);
        metrics.put("systemStatus", "Healthy (PostgreSQL & Spring Boot)");

        return ResponseEntity.ok(metrics);
    }
}
