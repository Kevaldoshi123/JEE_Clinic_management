package com.medeuon.clinic.controllers;

import com.medeuon.clinic.models.*;
import com.medeuon.clinic.repositories.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class AppointmentController {

    @Autowired
    private AppointmentRepository appointmentRepository;

    @Autowired
    private PatientRepository patientRepository;

    @Autowired
    private DoctorRepository doctorRepository;

    @Autowired
    private TokenRepository tokenRepository;

    @Autowired
    private QueueStateRepository queueStateRepository;

    private Map<String, Object> mapAppointment(Appointment a) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", a.getId());
        m.put("appointment_date", a.getAppointmentDate() != null ? a.getAppointmentDate().toString() : "");
        m.put("appointmentDate", a.getAppointmentDate() != null ? a.getAppointmentDate().toString() : "");
        m.put("appointment_time", a.getAppointmentTime() != null ? a.getAppointmentTime().toString() : "");
        m.put("appointmentTime", a.getAppointmentTime() != null ? a.getAppointmentTime().toString() : "");
        m.put("status", a.getStatus());
        m.put("notes", a.getNotes());
        
        if (a.getDoctor() != null) {
            m.put("doctor_id", a.getDoctor().getId());
            m.put("doctorId", a.getDoctor().getId());
            m.put("doctor_name", a.getDoctor().getFullName());
            m.put("doctorName", a.getDoctor().getFullName());
            m.put("specialization", a.getDoctor().getSpecialization());
        }

        if (a.getPatient() != null) {
            m.put("patient_id", a.getPatient().getId());
            m.put("patientId", a.getPatient().getId());
            m.put("patient_name", a.getPatient().getFullName());
            m.put("patientName", a.getPatient().getFullName());
            m.put("contact", a.getPatient().getContact());
            m.put("phone", a.getPatient().getContact());
            m.put("age", a.getPatient().getAge());
        }

        if (a.getToken() != null) {
            m.put("token_number", a.getToken().getTokenNumber());
            m.put("tokenNumber", a.getToken().getTokenNumber());
        }

        return m;
    }

    // List Appointments (Supports ?contact=... filter for patients or all appointments)
    @GetMapping("/appointments")
    public ResponseEntity<?> getAppointments(@RequestParam(required = false) String contact,
                                            @RequestParam(required = false) Long doctorId) {
        List<Appointment> list;
        if (contact != null && !contact.trim().isEmpty()) {
            List<Patient> patients = patientRepository.findByContact(contact.trim());
            if (!patients.isEmpty()) {
                list = appointmentRepository.findByPatientId(patients.get(0).getId());
            } else {
                list = Collections.emptyList();
            }
        } else if (doctorId != null) {
            list = appointmentRepository.findByDoctorId(doctorId);
        } else {
            list = appointmentRepository.findAll();
        }

        return ResponseEntity.ok(list.stream().map(this::mapAppointment).collect(Collectors.toList()));
    }

    // Approve Appointment
    @PostMapping("/appointments/{id}/approve")
    public ResponseEntity<?> approveAppointment(@PathVariable Long id) {
        Optional<Appointment> opt = appointmentRepository.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Appointment not found"));
        }

        Appointment appt = opt.get();
        appt.setStatus("approved");
        appointmentRepository.save(appt);
        return ResponseEntity.ok(Map.of("message", "Appointment approved successfully!", "appointment", mapAppointment(appt)));
    }

    // Reject Appointment
    @PostMapping("/appointments/{id}/reject")
    public ResponseEntity<?> rejectAppointment(@PathVariable Long id) {
        Optional<Appointment> opt = appointmentRepository.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Appointment not found"));
        }

        Appointment appt = opt.get();
        appt.setStatus("rejected");
        appointmentRepository.save(appt);
        return ResponseEntity.ok(Map.of("message", "Appointment rejected."));
    }

    // Public Appointment Booking Endpoint (from index.js / booking wizard)
    @PostMapping({"/public/appointments", "/appointments/book"})
    public ResponseEntity<?> bookPublicAppointment(@RequestBody Map<String, Object> body) {
        String name = (String) body.getOrDefault("fullName", body.get("name"));
        String contact = (String) body.getOrDefault("contact", body.get("phone"));
        Long doctorId = body.get("doctorId") != null ? ((Number) body.get("doctorId")).longValue() : 1L;

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
                    .fullName(name != null ? name : "Patient")
                    .contact(contact != null ? contact : "0000000000")
                    .age(body.get("age") != null ? ((Number) body.get("age")).intValue() : 28)
                    .gender((String) body.getOrDefault("gender", "other"))
                    .build();
            patient = patientRepository.save(patient);
        }

        // 2. Token Number
        LocalDate today = LocalDate.now();
        Optional<Integer> maxToken = tokenRepository.findMaxTokenNumberByDateAndDoctorId(today, doctorId);
        int nextTokenNum = maxToken.orElse(0) + 1;

        Token token = Token.builder()
                .tokenNumber(nextTokenNum)
                .tokenDate(today)
                .doctor(docOpt.get())
                .patient(patient)
                .status("waiting")
                .notes((String) body.getOrDefault("notes", "Online Website Booking"))
                .build();
        token = tokenRepository.save(token);

        // 3. Appointment
        Appointment appointment = Appointment.builder()
                .token(token)
                .patient(patient)
                .doctor(docOpt.get())
                .appointmentDate(today)
                .appointmentTime(LocalTime.now())
                .status("scheduled")
                .notes((String) body.getOrDefault("notes", "Scheduled via Web Booking"))
                .build();
        appointmentRepository.save(appointment);

        // 4. Update QueueState
        Optional<QueueState> qsOpt = queueStateRepository.findByQueueDateAndDoctorId(today, doctorId);
        QueueState qs = qsOpt.orElse(QueueState.builder().queueDate(today).doctorId(doctorId).build());
        qs.setLastToken(nextTokenNum);
        queueStateRepository.save(qs);

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Appointment registered successfully!");
        response.put("tokenNumber", nextTokenNum);
        response.put("token", nextTokenNum);
        response.put("appointmentId", appointment.getId());
        response.put("doctorName", docOpt.get().getFullName());
        return ResponseEntity.ok(response);
    }
}
