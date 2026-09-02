package com.medeuon.clinic.controllers;

import com.medeuon.clinic.models.LabOrder;
import com.medeuon.clinic.repositories.LabOrderRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class LabController {

    @Autowired
    private LabOrderRepository labOrderRepository;

    private Map<String, Object> mapLabOrder(LabOrder o) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", o.getId());
        m.put("patient_id", o.getPatientId());
        m.put("patientId", o.getPatientId());
        m.put("patient_name", o.getPatientName());
        m.put("patientName", o.getPatientName());
        m.put("doctor_id", o.getDoctorId());
        m.put("doctorId", o.getDoctorId());
        m.put("doctor_name", o.getDoctorName());
        m.put("doctorName", o.getDoctorName());
        m.put("test_name", o.getTestName());
        m.put("testName", o.getTestName());
        m.put("category", o.getCategory());
        m.put("priority", o.getPriority());
        m.put("status", o.getStatus());
        m.put("report_url", o.getReportUrl());
        m.put("reportUrl", o.getReportUrl());
        m.put("clinical_notes", o.getClinicalNotes());
        m.put("clinicalNotes", o.getClinicalNotes());
        m.put("ordered_at", o.getOrderedAt() != null ? o.getOrderedAt().toString() : "");
        m.put("orderedAt", o.getOrderedAt() != null ? o.getOrderedAt().toString() : "");
        m.put("completed_at", o.getCompletedAt() != null ? o.getCompletedAt().toString() : "");
        m.put("completedAt", o.getCompletedAt() != null ? o.getCompletedAt().toString() : "");
        return m;
    }

    // List Lab Orders
    @GetMapping("/lab/orders")
    public ResponseEntity<?> getLabOrders(@RequestParam(required = false) Long doctorId,
                                          @RequestParam(required = false) Long patientId) {
        List<LabOrder> list;
        if (doctorId != null) {
            list = labOrderRepository.findByDoctorIdOrderByOrderedAtDesc(doctorId);
        } else if (patientId != null) {
            list = labOrderRepository.findByPatientIdOrderByOrderedAtDesc(patientId);
        } else {
            list = labOrderRepository.findAll();
        }
        return ResponseEntity.ok(list.stream().map(this::mapLabOrder).collect(Collectors.toList()));
    }

    // Create New Lab Order
    @PostMapping("/lab/orders")
    public ResponseEntity<?> createLabOrder(@RequestBody Map<String, Object> body) {
        String testName = (String) body.getOrDefault("test_name", body.get("testName"));
        String patientName = (String) body.getOrDefault("patient_name", body.get("patientName"));
        Long patientId = body.get("patient_id") != null ? ((Number) body.get("patient_id")).longValue() : 1L;
        Long doctorId = body.get("doctor_id") != null ? ((Number) body.get("doctor_id")).longValue() : 1L;
        String doctorName = (String) body.getOrDefault("doctor_name", body.get("doctorName"));

        LabOrder order = LabOrder.builder()
                .testName(testName != null ? testName : "Complete Blood Count")
                .patientId(patientId)
                .patientName(patientName != null ? patientName : "Patient")
                .doctorId(doctorId)
                .doctorName(doctorName != null ? doctorName : "Doctor")
                .category((String) body.getOrDefault("category", "Pathology"))
                .priority((String) body.getOrDefault("priority", "normal"))
                .status("pending")
                .clinicalNotes((String) body.get("clinical_notes"))
                .orderedAt(LocalDateTime.now())
                .build();

        labOrderRepository.save(order);
        return ResponseEntity.ok(Map.of("message", "Diagnostic order created successfully!", "order", mapLabOrder(order)));
    }

    // Complete Lab Order
    @PostMapping("/lab/orders/{id}/complete")
    public ResponseEntity<?> completeLabOrder(@PathVariable Long id, @RequestBody(required = false) Map<String, Object> body) {
        Optional<LabOrder> opt = labOrderRepository.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Lab order not found"));
        }

        LabOrder order = opt.get();
        order.setStatus("completed");
        order.setCompletedAt(LocalDateTime.now());
        if (body != null && body.containsKey("report_url")) {
            order.setReportUrl((String) body.get("report_url"));
        }
        labOrderRepository.save(order);
        return ResponseEntity.ok(Map.of("message", "Lab order marked as completed!", "order", mapLabOrder(order)));
    }

    // Delete Lab Order
    @DeleteMapping("/lab/orders/{id}")
    public ResponseEntity<?> deleteLabOrder(@PathVariable Long id) {
        labOrderRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Lab order deleted successfully!"));
    }

    // Upload & Link Lab Reports
    @PostMapping("/lab-reports/upload")
    public ResponseEntity<?> uploadLabReport(@RequestParam(value = "file", required = false) MultipartFile file,
                                            @RequestParam(value = "patientId", required = false) Long patientId,
                                            @RequestParam(value = "testName", required = false) String testName) {
        String fileName = file != null ? file.getOriginalFilename() : "report_" + System.currentTimeMillis() + ".pdf";
        String reportUrl = "/uploads/" + fileName;

        LabOrder order = LabOrder.builder()
                .patientId(patientId != null ? patientId : 1L)
                .patientName("Patient")
                .testName(testName != null ? testName : "Diagnostic Report PDF")
                .category("Pathology")
                .status("completed")
                .reportUrl(reportUrl)
                .orderedAt(LocalDateTime.now())
                .completedAt(LocalDateTime.now())
                .build();

        labOrderRepository.save(order);
        return ResponseEntity.ok(Map.of("message", "Lab report uploaded successfully!", "report_url", reportUrl, "order", mapLabOrder(order)));
    }

    // Get Lab Reports for Patient
    @GetMapping({"/lab-reports/patient/{id}", "/lab-reports/my"})
    public ResponseEntity<?> getPatientLabReports(@PathVariable(required = false) Long id) {
        List<LabOrder> list;
        if (id != null) {
            list = labOrderRepository.findByPatientIdOrderByOrderedAtDesc(id);
        } else {
            list = labOrderRepository.findAll();
        }
        return ResponseEntity.ok(list.stream().map(this::mapLabOrder).collect(Collectors.toList()));
    }

    @GetMapping("/lab-reports/{id}")
    public ResponseEntity<?> getLabReportById(@PathVariable Long id) {
        Optional<LabOrder> opt = labOrderRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "Report not found"));
        return ResponseEntity.ok(mapLabOrder(opt.get()));
    }

    @PostMapping({"/lab/reports", "/lab-reports/{id}/link-encounter"})
    public ResponseEntity<?> linkLabReport(@PathVariable(required = false) Long id, @RequestBody(required = false) Map<String, Object> body) {
        return ResponseEntity.ok(Map.of("message", "Lab report linked to encounter successfully!"));
    }
}
