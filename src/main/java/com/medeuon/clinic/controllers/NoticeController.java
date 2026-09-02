package com.medeuon.clinic.controllers;

import com.medeuon.clinic.models.Notice;
import com.medeuon.clinic.repositories.NoticeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/notice")
public class NoticeController {

    @Autowired
    private NoticeRepository noticeRepository;

    // Get Active Notice / Announcement (Supports global & per-doctor notice)
    @GetMapping("/get")
    public ResponseEntity<?> getNotice(@RequestParam(required = false) Long doctorId) {
        Optional<Notice> noticeOpt;
        if (doctorId != null) {
            noticeOpt = noticeRepository.findTopByDoctorIdOrderByUpdatedAtDesc(doctorId);
        } else {
            noticeOpt = noticeRepository.findTopByDoctorIdIsNullOrderByUpdatedAtDesc();
        }

        Map<String, Object> response = new HashMap<>();
        if (noticeOpt.isPresent()) {
            Notice n = noticeOpt.get();
            Map<String, Object> data = new HashMap<>();
            data.put("id", n.getId());
            data.put("text", n.getText());
            data.put("doctorId", n.getDoctorId());
            data.put("doctor_id", n.getDoctorId());
            data.put("updated_at", n.getUpdatedAt().toString());
            data.put("updatedAt", n.getUpdatedAt().toString());
            response.put("status", "success");
            response.put("data", data);
        } else {
            Map<String, Object> data = new HashMap<>();
            data.put("text", "Care Core Clinic is operating normally. Please proceed to your assigned doctor consultation counter.");
            data.put("updated_at", LocalDateTime.now().toString());
            response.put("status", "success");
            response.put("data", data);
        }

        return ResponseEntity.ok(response);
    }

    // Set or Update Notice / Announcement
    @PostMapping("/set")
    public ResponseEntity<?> setNotice(@RequestBody Map<String, Object> body) {
        String text = (String) body.get("text");
        if (text == null || text.trim().isEmpty()) {
            text = (String) body.get("notice");
        }
        if (text == null || text.trim().isEmpty()) {
            text = (String) body.get("content");
        }

        if (text == null || text.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Notice text is required"));
        }

        Long doctorId = null;
        if (body.get("doctorId") != null) {
            doctorId = ((Number) body.get("doctorId")).longValue();
        } else if (body.get("doctor_id") != null) {
            doctorId = ((Number) body.get("doctor_id")).longValue();
        }

        Notice notice = Notice.builder()
                .doctorId(doctorId)
                .text(text.trim())
                .isActive(true)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        noticeRepository.save(notice);

        Map<String, Object> res = new HashMap<>();
        res.put("status", "success");
        res.put("message", "Notice broadcasted successfully!");
        res.put("data", Map.of("text", notice.getText(), "updated_at", notice.getUpdatedAt().toString()));
        return ResponseEntity.ok(res);
    }
}
