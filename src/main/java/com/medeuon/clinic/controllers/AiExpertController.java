package com.medeuon.clinic.controllers;

import com.medeuon.clinic.services.AiExpertService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ai")
public class AiExpertController {

    @Autowired
    private AiExpertService aiExpertService;

    // Get Dynamic AI Model Training Status & Accuracy
    @GetMapping("/model-status")
    public ResponseEntity<?> getModelStatus() {
        return ResponseEntity.ok(aiExpertService.getModelStatus());
    }

    // Process Medical Query / Lab Report Analysis / Doctor Second Opinion
    @PostMapping("/chat")
    public ResponseEntity<?> processMedicalChat(@RequestBody Map<String, Object> body) {
        String query = (String) body.get("query");
        String doctorSuggestion = (String) body.get("doctorSuggestion");
        
        @SuppressWarnings("unchecked")
        Map<String, String> labMetrics = (Map<String, String>) body.get("labMetrics");

        Map<String, Object> result = aiExpertService.processMedicalAnalysis(query, doctorSuggestion, labMetrics);
        return ResponseEntity.ok(result);
    }
}
