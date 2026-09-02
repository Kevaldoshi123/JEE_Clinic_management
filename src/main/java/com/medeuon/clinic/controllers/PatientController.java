package com.medeuon.clinic.controllers;

import com.medeuon.clinic.models.*;
import com.medeuon.clinic.repositories.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;

@RestController
@RequestMapping("/api/patient")
public class PatientController {

    @Autowired
    private DoctorRepository doctorRepository;

    @Autowired
    private PatientRepository patientRepository;

    @Autowired
    private TokenRepository tokenRepository;

    @Autowired
    private AppointmentRepository appointmentRepository;

    @Autowired
    private QueueStateRepository queueStateRepository;

    // Get Active & Approved Doctors
    @GetMapping("/doctors")
    public ResponseEntity<?> getApprovedDoctors() {
        return ResponseEntity.ok(doctorRepository.findByApprovalStatusAndIsActiveTrue("approved"));
    }

    // Book Appointment & Generate Queue Token
    @PostMapping("/book")
    public ResponseEntity<?> bookAppointment(@RequestBody Map<String, Object> body) {
        String name = (String) body.get("fullName");
        String contact = (String) body.get("contact");
        Integer age = body.get("age") != null ? ((Number) body.get("age")).intValue() : 25;
        Long doctorId = ((Number) body.get("doctorId")).longValue();

        Optional<Doctor> docOpt = doctorRepository.findById(doctorId);
        if (docOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Doctor not found"));
        }

        // 1. Find or create patient
        List<Patient> existing = patientRepository.findByContact(contact);
        Patient patient;
        if (!existing.isEmpty()) {
            patient = existing.get(0);
        } else {
            patient = Patient.builder()
                    .fullName(name)
                    .contact(contact)
                    .age(age)
                    .gender((String) body.getOrDefault("gender", "other"))
                    .build();
            patient = patientRepository.save(patient);
        }

        // 2. Generate Next Token Number
        LocalDate today = LocalDate.now();
        Optional<Integer> maxToken = tokenRepository.findMaxTokenNumberByDateAndDoctorId(today, doctorId);
        int nextTokenNum = maxToken.orElse(0) + 1;

        Token token = Token.builder()
                .tokenNumber(nextTokenNum)
                .tokenDate(today)
                .doctor(docOpt.get())
                .patient(patient)
                .status("waiting")
                .notes((String) body.get("notes"))
                .build();
        token = tokenRepository.save(token);

        // 3. Save Appointment
        Appointment appointment = Appointment.builder()
                .token(token)
                .patient(patient)
                .doctor(docOpt.get())
                .appointmentDate(today)
                .appointmentTime(LocalTime.now())
                .status("scheduled")
                .build();
        appointmentRepository.save(appointment);

        // 4. Update QueueState
        Optional<QueueState> qsOpt = queueStateRepository.findByQueueDateAndDoctorId(today, doctorId);
        QueueState qs = qsOpt.orElse(QueueState.builder().queueDate(today).doctorId(doctorId).build());
        qs.setLastToken(nextTokenNum);
        queueStateRepository.save(qs);

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Appointment & Token Booked Successfully!");
        response.put("tokenNumber", nextTokenNum);
        response.put("patientId", patient.getUniqueId());
        response.put("doctorName", docOpt.get().getFullName());

        return ResponseEntity.ok(response);
    }
}
