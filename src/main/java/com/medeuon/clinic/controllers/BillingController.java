package com.medeuon.clinic.controllers;

import com.medeuon.clinic.models.Bill;
import com.medeuon.clinic.repositories.BillRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class BillingController {

    @Autowired
    private BillRepository billRepository;

    private Map<String, Object> mapBill(Bill b) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", b.getId());
        m.put("bill_id", b.getId());
        m.put("patient_id", b.getPatientId());
        m.put("patientId", b.getPatientId());
        m.put("patient_name", b.getPatientName());
        m.put("patientName", b.getPatientName());
        m.put("doctor_id", b.getDoctorId());
        m.put("doctorId", b.getDoctorId());
        m.put("doctor_name", b.getDoctorName());
        m.put("doctorName", b.getDoctorName());
        m.put("token_number", b.getTokenNumber());
        m.put("tokenNumber", b.getTokenNumber());
        m.put("amount", b.getAmount());
        m.put("payment_status", b.getPaymentStatus());
        m.put("paymentStatus", b.getPaymentStatus());
        m.put("payment_method", b.getPaymentMethod());
        m.put("paymentMethod", b.getPaymentMethod());
        m.put("description", b.getDescription());
        m.put("created_at", b.getCreatedAt() != null ? b.getCreatedAt().toString() : "");
        m.put("createdAt", b.getCreatedAt() != null ? b.getCreatedAt().toString() : "");
        m.put("paid_at", b.getPaidAt() != null ? b.getPaidAt().toString() : "");
        m.put("paidAt", b.getPaidAt() != null ? b.getPaidAt().toString() : "");
        return m;
    }

    // Get Invoices / Bills list
    @GetMapping("/bills")
    public ResponseEntity<?> getBills(@RequestParam(required = false) Long doctorId,
                                      @RequestParam(required = false) Long patientId,
                                      @RequestParam(required = false) String status) {
        List<Bill> list;
        if (doctorId != null) {
            list = billRepository.findByDoctorIdOrderByCreatedAtDesc(doctorId);
        } else if (patientId != null) {
            list = billRepository.findByPatientIdOrderByCreatedAtDesc(patientId);
        } else if (status != null && !status.isEmpty()) {
            list = billRepository.findByPaymentStatusOrderByCreatedAtDesc(status);
        } else {
            list = billRepository.findAll();
        }
        return ResponseEntity.ok(list.stream().map(this::mapBill).collect(Collectors.toList()));
    }

    // Pay Bill Action
    @PostMapping({"/bills/{id}/pay", "/bills/{id}/complete"})
    public ResponseEntity<?> payBill(@PathVariable Long id, @RequestBody(required = false) Map<String, Object> body) {
        Optional<Bill> billOpt = billRepository.findById(id);
        if (billOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Bill not found"));
        }

        Bill bill = billOpt.get();
        bill.setPaymentStatus("paid");
        bill.setPaidAt(LocalDateTime.now());
        if (body != null && body.containsKey("payment_method")) {
            bill.setPaymentMethod((String) body.get("payment_method"));
        } else if (body != null && body.containsKey("paymentMethod")) {
            bill.setPaymentMethod((String) body.get("paymentMethod"));
        } else if (bill.getPaymentMethod() == null) {
            bill.setPaymentMethod("UPI/QR");
        }
        billRepository.save(bill);

        return ResponseEntity.ok(Map.of("message", "Bill marked as PAID successfully!", "bill", mapBill(bill)));
    }

    // Generate New Bill from Checkout / Encounter
    @PostMapping("/clinic/billing")
    public ResponseEntity<?> createBilling(@RequestBody Map<String, Object> body) {
        String patientName = (String) body.getOrDefault("patient_name", body.get("patientName"));
        Long patientId = body.get("patient_id") != null ? ((Number) body.get("patient_id")).longValue() : 1L;
        Long doctorId = body.get("doctor_id") != null ? ((Number) body.get("doctor_id")).longValue() : 1L;
        String doctorName = (String) body.getOrDefault("doctor_name", body.get("doctorName"));
        Integer tokenNumber = body.get("token_number") != null ? ((Number) body.get("token_number")).intValue() : null;
        
        BigDecimal amount = BigDecimal.valueOf(500.00);
        if (body.get("amount") != null) {
            amount = BigDecimal.valueOf(((Number) body.get("amount")).doubleValue());
        }

        Bill bill = Bill.builder()
                .patientId(patientId)
                .patientName(patientName != null ? patientName : "Patient")
                .doctorId(doctorId)
                .doctorName(doctorName != null ? doctorName : "Doctor")
                .tokenNumber(tokenNumber)
                .amount(amount)
                .paymentStatus("pending")
                .description((String) body.getOrDefault("description", "Consultation & Prescription Fee"))
                .paymentMethod((String) body.getOrDefault("payment_method", "Cash"))
                .createdAt(LocalDateTime.now())
                .build();

        billRepository.save(bill);
        return ResponseEntity.ok(Map.of("message", "Invoice generated successfully!", "bill_id", bill.getId(), "bill", mapBill(bill)));
    }

    // Cash Register Report
    @GetMapping("/reports/cash-register")
    public ResponseEntity<?> getCashRegisterReport(@RequestParam(required = false) String date) {
        LocalDateTime start = LocalDate.now().atStartOfDay();
        LocalDateTime end = LocalDate.now().atTime(LocalTime.MAX);

        List<Bill> todayBills = billRepository.findByCreatedAtBetweenOrderByCreatedAtDesc(start, end);
        BigDecimal totalCollected = todayBills.stream()
                .filter(b -> "paid".equalsIgnoreCase(b.getPaymentStatus()))
                .map(Bill::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> res = new HashMap<>();
        res.put("date", date != null ? date : LocalDate.now().toString());
        res.put("totalCollected", totalCollected);
        res.put("total_collected", totalCollected);
        res.put("transactionsCount", todayBills.size());
        res.put("transactions", todayBills.stream().map(this::mapBill).collect(Collectors.toList()));
        return ResponseEntity.ok(res);
    }
}
