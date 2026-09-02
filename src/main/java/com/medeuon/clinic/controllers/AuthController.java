package com.medeuon.clinic.controllers;

import com.medeuon.clinic.models.Admin;
import com.medeuon.clinic.models.Doctor;
import com.medeuon.clinic.models.Patient;
import com.medeuon.clinic.repositories.AdminRepository;
import com.medeuon.clinic.repositories.DoctorRepository;
import com.medeuon.clinic.repositories.PatientRepository;
import com.medeuon.clinic.security.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private AdminRepository adminRepository;

    @Autowired
    private DoctorRepository doctorRepository;

    @Autowired
    private PatientRepository patientRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    // Login Endpoint for Admins and Doctors
    @PostMapping({"/login", "/doctor/login", "/admin/login"})
    public ResponseEntity<?> login(@RequestBody Map<String, String> request) {
        String usernameOrEmail = request.get("username");
        if (usernameOrEmail == null || usernameOrEmail.trim().isEmpty()) {
            usernameOrEmail = request.get("email");
        }
        String password = request.get("password");

        if (usernameOrEmail == null || password == null) {
            return ResponseEntity.status(400).body(Map.of("error", "Email/Username and Password are required"));
        }

        // 1. Try Admin login
        Optional<Admin> adminOpt = adminRepository.findByUsername(usernameOrEmail);
        if (adminOpt.isEmpty()) {
            adminOpt = adminRepository.findByEmail(usernameOrEmail);
        }

        if (adminOpt.isPresent()) {
            Admin admin = adminOpt.get();
            if (passwordEncoder.matches(password, admin.getPasswordHash())) {
                String token = jwtUtil.generateToken(admin.getId(), admin.getEmail(), admin.getRole(), admin.getFullName());
                Map<String, Object> res = new HashMap<>();
                res.put("token", token);
                res.put("userType", "admin");
                res.put("user", admin);
                res.put("admin", admin);
                return ResponseEntity.ok(res);
            }
        }

        // 2. Try Doctor login
        Optional<Doctor> doctorOpt = doctorRepository.findByEmail(usernameOrEmail);
        if (doctorOpt.isPresent()) {
            Doctor doctor = doctorOpt.get();
            if (passwordEncoder.matches(password, doctor.getPasswordHash())) {
                String token = jwtUtil.generateToken(doctor.getId(), doctor.getEmail(), "doctor", doctor.getFullName());
                Map<String, Object> res = new HashMap<>();
                res.put("token", token);
                res.put("userType", "doctor");
                res.put("user", doctor);
                res.put("doctor", doctor);
                return ResponseEntity.ok(res);
            }
        }

        return ResponseEntity.status(401).body(Map.of("error", "Invalid email or password"));
    }

    // Patient Registration
    @PostMapping("/register-patient")
    public ResponseEntity<?> registerPatient(@RequestBody Patient patient) {
        if (patient.getContact() == null || patient.getFullName() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Name and contact are required"));
        }
        Patient saved = patientRepository.save(patient);
        return ResponseEntity.ok(saved);
    }

    // Doctor Registration (From Wizard)
    @PostMapping("/register-doctor")
    public ResponseEntity<?> registerDoctor(@RequestBody Map<String, Object> request) {
        String email = (String) request.get("email");
        String phone = (String) request.get("phone");
        String regNum = (String) request.get("registrationNumber");
        String password = (String) request.get("password");

        if (email == null || regNum == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing required doctor details"));
        }

        if (doctorRepository.existsByEmail(email)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Doctor with this email already exists"));
        }

        if (doctorRepository.existsByRegistrationNumber(regNum)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Doctor with this registration number already exists"));
        }

        Doctor doctor = Doctor.builder()
                .fullName((String) request.get("fullName"))
                .email(email)
                .phone(phone)
                .gender((String) request.get("gender"))
                .dateOfBirth((String) request.get("dateOfBirth"))
                .profilePhotoUrl((String) request.get("profilePhotoUrl"))
                .passwordHash(passwordEncoder.encode(password))
                .registrationNumber(regNum)
                .medicalCouncil((String) request.get("medicalCouncil"))
                .qualification((String) request.get("qualification"))
                .specialization((String) request.get("specialization"))
                .yearsExperience(request.get("yearsExperience") != null ? ((Number) request.get("yearsExperience")).intValue() : 0)
                .hospital((String) request.get("hospital"))
                .department((String) request.get("department"))
                .languagesSpoken((String) request.get("languagesSpoken"))
                .profileBio((String) request.get("profileBio"))
                .consultationFee(request.get("consultationFee") != null ? java.math.BigDecimal.valueOf(((Number) request.get("consultationFee")).doubleValue()) : java.math.BigDecimal.valueOf(500.00))
                .slotDuration(request.get("slotDuration") != null ? ((Number) request.get("slotDuration")).intValue() : 15)
                .availableDays((String) request.get("availableDays"))
                .workingHours((String) request.get("workingHours"))
                .clinicAddress((String) request.get("clinicAddress"))
                .isOnlineAvailable(Boolean.TRUE.equals(request.get("isOnlineAvailable")))
                .isOfflineAvailable(Boolean.TRUE.equals(request.get("isOfflineAvailable")))
                .approvalStatus("pending")
                .isActive(true)
                .isServiceActive(true)
                .build();

        Doctor saved = doctorRepository.save(doctor);
        return ResponseEntity.ok(Map.of("message", "Doctor registration submitted successfully! Pending approval.", "doctorId", saved.getId()));
    }
}
