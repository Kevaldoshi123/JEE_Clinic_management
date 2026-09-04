package com.medeuon.clinic.controllers;

import com.medeuon.clinic.models.*;
import com.medeuon.clinic.repositories.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api")
public class PublicQueueController {

    @Autowired
    private DoctorRepository doctorRepository;

    @Autowired
    private PatientRepository patientRepository;

    @Autowired
    private TokenRepository tokenRepository;

    @Autowired
    private QueueStateRepository queueStateRepository;

    // 0. Server Network Info (Auto-detects LAN Wi-Fi IP for Mobile QR codes)
    @GetMapping("/public/server-info")
    public ResponseEntity<?> getServerInfo(jakarta.servlet.http.HttpServletRequest request) {
        String hostIp = "127.0.0.1";
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                NetworkInterface iface = interfaces.nextElement();
                if (iface.isLoopback() || !iface.isUp()) continue;
                Enumeration<InetAddress> addresses = iface.getInetAddresses();
                while (addresses.hasMoreElements()) {
                    InetAddress addr = addresses.nextElement();
                    if (addr instanceof Inet4Address && !addr.isLoopbackAddress() && !addr.getHostAddress().startsWith("169.254")) {
                        String candidate = addr.getHostAddress();
                        if (!candidate.startsWith("192.168.135") && !candidate.startsWith("192.168.22")) {
                            hostIp = candidate;
                            break;
                        } else if (hostIp.equals("127.0.0.1")) {
                            hostIp = candidate;
                        }
                    }
                }
            }
        } catch (Exception ignored) {}

        int port = request.getServerPort();
        if (port <= 0) port = 8085;

        Map<String, Object> res = new HashMap<>();
        res.put("ip", hostIp);
        res.put("port", port);
        res.put("baseUrl", "http://" + hostIp + ":" + port);
        res.put("kioskUrl", "http://" + hostIp + ":" + port + "/generate-token.html");
        res.put("displayUrl", "http://" + hostIp + ":" + port + "/display.html");
        res.put("patientUrl", "http://" + hostIp + ":" + port + "/patient_portal_design.html");
        return ResponseEntity.ok(res);
    }

    // 1. Clinic Data (Get all doctors for index.js dropdown/grid)
    @GetMapping("/clinic/data")
    public ResponseEntity<?> getClinicData() {
        List<Doctor> doctors = doctorRepository.findAll();
        Map<String, Object> response = new HashMap<>();
        
        List<Map<String, Object>> doctorList = new ArrayList<>();
        for (Doctor d : doctors) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", d.getId());
            map.put("full_name", d.getFullName());
            map.put("specialization", d.getSpecialization());
            map.put("qualification", d.getQualification());
            map.put("consultation_fee", d.getConsultationFee());
            map.put("profile_photo_url", d.getProfilePhotoUrl());
            map.put("years_experience", d.getYearsExperience());
            map.put("is_on_leave", false);
            doctorList.add(map);
        }
        
        response.put("doctors", doctorList);
        return ResponseEntity.ok(response);
    }

    // Concurrent synchronized live queue tokens list
    private static final List<Map<String, Object>> liveQueueTokens = new java.util.concurrent.CopyOnWriteArrayList<>();
    private static volatile int currentServingToken = 24;
    private static volatile String lastActionType = "call";
    private static volatile long lastActionTimestamp = System.currentTimeMillis();

    static {
        initDefaultTokens();
    }

    private static void initDefaultTokens() {
        if (!liveQueueTokens.isEmpty()) return;
        Map<String, Object> t1 = new LinkedHashMap<>();
        t1.put("id", 1L);
        t1.put("token", "#024");
        t1.put("tokenNumber", 24);
        t1.put("name", "Sakshi Sardhara");
        t1.put("doctor", "Dr. Sakshi Patel");
        t1.put("doctorId", 1L);
        t1.put("dept", "General Cardiology (Room 101)");
        t1.put("status", "Now Serving");
        t1.put("time", "10:30 AM");
        t1.put("age", 22);
        t1.put("gender", "Female");
        t1.put("blood", "B+");
        t1.put("bp", "135/85 mmHg");
        t1.put("hr", "78 bpm");
        t1.put("sugar", "165 mg/dL");
        t1.put("complaint", "Chest Pain Evaluation & Hypertension Review. Patient reports mild exertion fatigue.");
        t1.put("initials", "SS");
        liveQueueTokens.add(t1);

        Map<String, Object> t2 = new LinkedHashMap<>();
        t2.put("id", 2L);
        t2.put("token", "#025");
        t2.put("tokenNumber", 25);
        t2.put("name", "Jia Patel");
        t2.put("doctor", "Dr. Keshav Kumar");
        t2.put("doctorId", 2L);
        t2.put("dept", "Cardiology (Room 102)");
        t2.put("status", "Waiting");
        t2.put("time", "10:45 AM");
        t2.put("age", 25);
        t2.put("gender", "Female");
        t2.put("blood", "A+");
        t2.put("bp", "118/75 mmHg");
        t2.put("hr", "72 bpm");
        t2.put("sugar", "110 mg/dL");
        t2.put("complaint", "Routine Cardiology Consultation & Blood Pressure Check. Mild headache reported.");
        t2.put("initials", "JP");
        liveQueueTokens.add(t2);

        Map<String, Object> t3 = new LinkedHashMap<>();
        t3.put("id", 3L);
        t3.put("token", "#026");
        t3.put("tokenNumber", 26);
        t3.put("name", "Aarav Sharma");
        t3.put("doctor", "Dr. Sakshi Patel");
        t3.put("doctorId", 1L);
        t3.put("dept", "Cardiology (Room 101)");
        t3.put("status", "Waiting");
        t3.put("time", "11:00 AM");
        t3.put("age", 28);
        t3.put("gender", "Male");
        t3.put("blood", "O+");
        t3.put("bp", "125/80 mmHg");
        t3.put("hr", "80 bpm");
        t3.put("sugar", "140 mg/dL");
        t3.put("complaint", "Lipid Profile & BP Check. Follow up for dietary modifications.");
        t3.put("initials", "AS");
        liveQueueTokens.add(t3);
    }

    // 2. Generate Queue Token (Instant token creation from mobile QR kiosk)
    @PostMapping({"/public/queue/generate", "/queue/token"})
    public ResponseEntity<?> generateToken(@RequestBody Map<String, Object> body) {
        String name = (String) body.getOrDefault("name", body.get("fullName"));
        String contact = (String) body.getOrDefault("contact", body.get("phone"));
        if (name == null || name.isBlank()) name = "Walk-In Patient";
        if (contact == null || contact.isBlank()) contact = "+91 98765 43210";

        String dept = (String) body.getOrDefault("dept", "Cardiology");
        String doctorName = (String) body.getOrDefault("doctorName", body.get("doctor"));
        if (doctorName == null || doctorName.isBlank()) {
            if ("Dermatology".equalsIgnoreCase(dept)) doctorName = "Dr. Rajani Shah";
            else if ("General Medicine".equalsIgnoreCase(dept)) doctorName = "Dr. Keshav Kumar";
            else doctorName = "Dr. Sakshi Patel";
        }

        // Calculate next token number dynamically
        int maxNum = 26;
        for (Map<String, Object> t : liveQueueTokens) {
            Object numObj = t.get("tokenNumber");
            if (numObj instanceof Number) {
                int n = ((Number) numObj).intValue();
                if (n > maxNum) maxNum = n;
            }
        }
        int nextTokenNum = maxNum + 1;
        String tokenStr = String.format("#%03d", nextTokenNum);

        String timeStr = java.time.LocalTime.now().format(java.time.format.DateTimeFormatter.ofPattern("hh:mm a"));

        Map<String, Object> newToken = new LinkedHashMap<>();
        newToken.put("id", (long) nextTokenNum);
        newToken.put("token", tokenStr);
        newToken.put("tokenNumber", nextTokenNum);
        newToken.put("name", name);
        newToken.put("doctor", doctorName);
        newToken.put("doctorId", 1L);
        newToken.put("dept", dept.contains("(") ? dept : dept + " (Room 101)");
        newToken.put("status", "Waiting");
        newToken.put("time", timeStr);
        newToken.put("age", body.getOrDefault("age", 25));
        newToken.put("gender", body.getOrDefault("gender", "Other"));
        newToken.put("blood", body.getOrDefault("blood", "B+"));
        newToken.put("bp", "120/80 mmHg");
        newToken.put("hr", "72 bpm");
        newToken.put("sugar", "100 mg/dL");
        newToken.put("complaint", body.getOrDefault("complaint", "General Outpatient Consultation"));
        String[] parts = name.trim().split("\\s+");
        String initials = parts.length > 1 ? ("" + parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase() : ("" + name.charAt(0)).toUpperCase();
        newToken.put("initials", initials);

        liveQueueTokens.add(newToken);

        // Async try saving to database
        try {
            LocalDate today = LocalDate.now();
            List<Patient> existing = patientRepository.findByContact(contact);
            Patient patient = existing.isEmpty() ? patientRepository.save(Patient.builder().fullName(name).contact(contact).age(25).gender("Other").build()) : existing.get(0);
            List<Doctor> docs = doctorRepository.findAll();
            Doctor doc = docs.isEmpty() ? null : docs.get(0);
            if (doc != null) {
                Token dbToken = Token.builder().tokenNumber(nextTokenNum).tokenDate(today).doctor(doc).patient(patient).status("waiting").notes("Mobile QR check-in").build();
                tokenRepository.save(dbToken);
            }
        } catch (Exception ignored) {}

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("token", tokenStr);
        res.put("tokenNumber", nextTokenNum);
        res.put("name", name);
        res.put("doctor", doctorName);
        res.put("status", "Waiting");
        res.put("time", timeStr);
        res.put("message", "Token " + tokenStr + " generated successfully! You are in queue.");
        return ResponseEntity.ok(res);
    }

    // 2.1 Get All Active Queue Tokens for Today
    @GetMapping({"/public/queue/all", "/queue/all"})
    public ResponseEntity<?> getAllQueueTokens() {
        return ResponseEntity.ok(liveQueueTokens);
    }

    // 2.2 Doctor Action on Token (Call / Approve, Skip, Recall, Complete)
    @PostMapping({"/public/queue/action", "/queue/action"})
    public ResponseEntity<?> handleQueueAction(@RequestBody Map<String, Object> body) {
        int tokenNum = 0;
        if (body.get("tokenNumber") != null) {
            tokenNum = ((Number) body.get("tokenNumber")).intValue();
        } else if (body.get("token") != null) {
            String ts = body.get("token").toString().replace("#", "").trim();
            try { tokenNum = Integer.parseInt(ts); } catch (Exception ignored) {}
        }
        String action = (String) body.getOrDefault("action", "call");

        Map<String, Object> targetToken = null;
        for (Map<String, Object> t : liveQueueTokens) {
            if (Objects.equals(t.get("tokenNumber"), tokenNum)) {
                targetToken = t;
                break;
            }
        }

        if (targetToken == null && !liveQueueTokens.isEmpty()) {
            targetToken = liveQueueTokens.get(0);
            tokenNum = ((Number) targetToken.get("tokenNumber")).intValue();
        }

        if (targetToken == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Token not found"));
        }

        if ("call".equalsIgnoreCase(action) || "recall".equalsIgnoreCase(action)) {
            for (Map<String, Object> t : liveQueueTokens) {
                if ("Now Serving".equals(t.get("status"))) {
                    t.put("status", "Completed");
                }
            }
            targetToken.put("status", "Now Serving");
            currentServingToken = tokenNum;
            lastActionType = action.toLowerCase();
            lastActionTimestamp = System.currentTimeMillis();
        } else if ("skip".equalsIgnoreCase(action)) {
            targetToken.put("status", "Skipped");
            lastActionType = "skip";
            lastActionTimestamp = System.currentTimeMillis();
        } else if ("complete".equalsIgnoreCase(action)) {
            targetToken.put("status", "Completed");
            lastActionType = "complete";
            lastActionTimestamp = System.currentTimeMillis();
        }

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("tokenNumber", tokenNum);
        res.put("token", targetToken.get("token"));
        res.put("name", targetToken.get("name"));
        res.put("status", targetToken.get("status"));
        res.put("currentNumber", currentServingToken);
        res.put("actionTs", lastActionTimestamp);
        res.put("message", "Token " + targetToken.get("token") + " (" + targetToken.get("name") + ") is now " + targetToken.get("status") + "!");
        return ResponseEntity.ok(res);
    }

    // 2.3 Individual Token Status Polling (for Patient's Mobile screen)
    @GetMapping("/public/queue/token-status")
    public ResponseEntity<?> getTokenStatus(@RequestParam(required = false) String token, @RequestParam(required = false) Integer tokenNumber) {
        int num = 0;
        if (tokenNumber != null) {
            num = tokenNumber;
        } else if (token != null) {
            try { num = Integer.parseInt(token.replace("#", "").trim()); } catch (Exception ignored) {}
        }

        Map<String, Object> found = null;
        for (Map<String, Object> t : liveQueueTokens) {
            if (Objects.equals(t.get("tokenNumber"), num)) {
                found = t;
                break;
            }
        }

        boolean isServing = (currentServingToken == num);
        String status = found != null ? (String) found.get("status") : (isServing ? "Now Serving" : "Waiting");

        Map<String, Object> res = new HashMap<>();
        res.put("tokenNumber", num);
        res.put("token", String.format("#%03d", num));
        res.put("status", status);
        res.put("currentServing", currentServingToken);
        res.put("isNowServing", isServing || "Now Serving".equalsIgnoreCase(status));
        res.put("doctor", found != null ? found.get("doctor") : "Dr. Sakshi Patel");
        res.put("room", "Room 101");
        res.put("message", isServing ? "🟢 It is your turn! Please proceed to Consultation Room 101." : "🟡 Please wait in the waiting lounge. Currently serving #" + String.format("%03d", currentServingToken));
        return ResponseEntity.ok(res);
    }

    // 3. Queue State API (For live queue board display updates & audio alerts)
    @GetMapping("/queue/state")
    public ResponseEntity<?> getQueueState(@RequestParam(required = false) Long doctorId) {
        int waitingCount = 0;
        int maxToken = 26;
        for (Map<String, Object> t : liveQueueTokens) {
            Object numObj = t.get("tokenNumber");
            if (numObj instanceof Number) {
                int n = ((Number) numObj).intValue();
                if (n > maxToken) maxToken = n;
            }
            if ("Waiting".equalsIgnoreCase((String) t.get("status"))) {
                waitingCount++;
            }
        }

        int capacityPct = maxToken > 0 ? (int) Math.round(((double) currentServingToken / maxToken) * 100) : 75;

        Map<String, Object> res = new HashMap<>();
        res.put("boardName", "General Cardiology Board");
        res.put("currentNumber", String.format("%03d", currentServingToken));
        res.put("rawCurrentNumber", currentServingToken);
        res.put("current_number", currentServingToken);
        res.put("last_action", lastActionType);
        res.put("lastAction", lastActionType);
        res.put("action_ts", lastActionTimestamp);
        res.put("actionTs", lastActionTimestamp);
        res.put("lastToken", maxToken);
        res.put("last_token", maxToken);
        res.put("handlingDoctor", "Dr. Sakshi Patel");
        res.put("estimatedWaitTime", "~" + (waitingCount * 3 > 0 ? waitingCount * 3 : 10) + " Minutes");
        res.put("patientsWaiting", waitingCount + " Patients");
        res.put("capacityProcessed", capacityPct + "%");
        res.put("capacityPctNum", capacityPct);
        res.put("tokens", liveQueueTokens);

        return ResponseEntity.ok(res);
    }

    // 4. Clinic Locations Map API (Multiple Branches)
    @GetMapping("/clinics/locations")
    public ResponseEntity<?> getClinicLocations() {
        List<Map<String, Object>> locations = new ArrayList<>();

        Map<String, Object> branch1 = new HashMap<>();
        branch1.put("name", "Care Core General Cardiology Board & Hospital");
        branch1.put("full_name", "Dr. Sakshi Patel - Cardiology Center");
        branch1.put("specialization", "General Cardiology & Heart Care");
        branch1.put("lat", 19.0760);
        branch1.put("lng", 72.8777);
        branch1.put("years_experience", 15);
        branch1.put("address", "Care Core Medical Complex, MG Road, Mumbai");

        Map<String, Object> branch2 = new HashMap<>();
        branch2.put("name", "Care Core Dermatology & Skin Clinic");
        branch2.put("full_name", "Dr. Rajani Shah - Skin Center");
        branch2.put("specialization", "Dermatology & Cosmetology");
        branch2.put("lat", 19.0825);
        branch2.put("lng", 72.8890);
        branch2.put("years_experience", 12);
        branch2.put("address", "Care Core Plaza, Bandra West, Mumbai");

        Map<String, Object> branch3 = new HashMap<>();
        branch3.put("name", "Care Core Central Pharmacy & Lab Hub");
        branch3.put("full_name", "Care Core Pharmacy Hub");
        branch3.put("specialization", "Pharmacy & Diagnostic Diagnostics");
        branch3.put("lat", 19.0680);
        branch3.put("lng", 72.8650);
        branch3.put("years_experience", 10);
        branch3.put("address", "Care Core Diagnostics Wing, Kurla, Mumbai");

        locations.add(branch1);
        locations.add(branch2);
        locations.add(branch3);

        return ResponseEntity.ok(locations);
    }
}
