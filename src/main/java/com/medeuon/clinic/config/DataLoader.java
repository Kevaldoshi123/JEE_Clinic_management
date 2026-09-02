package com.medeuon.clinic.config;

import com.medeuon.clinic.models.*;
import com.medeuon.clinic.repositories.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Component
public class DataLoader implements CommandLineRunner {

    @Autowired
    private AdminRepository adminRepository;

    @Autowired
    private DoctorRepository doctorRepository;

    @Autowired
    private PatientRepository patientRepository;

    @Autowired
    private QueueStateRepository queueStateRepository;

    @Autowired
    private TokenRepository tokenRepository;

    @Autowired
    private AppointmentRepository appointmentRepository;

    @Autowired
    private NoticeRepository noticeRepository;

    @Autowired
    private InventoryRepository inventoryRepository;

    @Autowired
    private BillRepository billRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        // 1. Seed Superadmin Account
        if (adminRepository.count() == 0) {
            Admin admin = Admin.builder()
                    .username("admin")
                    .email("admin@carecore.com")
                    .passwordHash(passwordEncoder.encode("Admin@123"))
                    .fullName("System Administrator")
                    .role("superadmin")
                    .isActive(true)
                    .build();
            adminRepository.save(admin);
            System.out.println("✅ Seeded Admin Account: admin / Admin@123");
        }

        // 2. Seed Specialist Doctor Accounts (Including Dr. Sakshi Patel as shown in screenshot)
        if (doctorRepository.count() == 0) {
            Doctor doc1 = Doctor.builder()
                    .fullName("Dr. Sakshi Patel")
                    .email("sakshi.patel@carecore.com")
                    .phone("9876543200")
                    .passwordHash(passwordEncoder.encode("Doctor@123"))
                    .specialization("General Cardiology")
                    .qualification("MD, DM Cardiology")
                    .registrationNumber("REG-50912")
                    .yearsExperience(14)
                    .consultationFee(BigDecimal.valueOf(1200.00))
                    .profileBio("Lead Senior Interventional Cardiologist specializing in preventive cardiology and heart care.")
                    .approvalStatus("approved")
                    .isServiceActive(true)
                    .isActive(true)
                    .workingHours("09:00 AM - 05:00 PM")
                    .availableDays("Mon, Tue, Wed, Thu, Fri")
                    .build();

            Doctor doc2 = Doctor.builder()
                    .fullName("Dr. Rajani Shah")
                    .email("rajani@carecore.com")
                    .phone("9876543210")
                    .passwordHash(passwordEncoder.encode("Doctor@123"))
                    .specialization("Dermatology")
                    .qualification("MD, DNB")
                    .registrationNumber("REG-40837")
                    .yearsExperience(15)
                    .consultationFee(BigDecimal.valueOf(1500.00))
                    .profileBio("Specialist in general and cosmetic dermatology.")
                    .approvalStatus("approved")
                    .isServiceActive(true)
                    .isActive(true)
                    .workingHours("10:00 AM - 06:00 PM")
                    .availableDays("Mon, Tue, Wed, Thu, Sat")
                    .build();

            Doctor doc3 = Doctor.builder()
                    .fullName("Dr. Keshav Kumar")
                    .email("keshav@carecore.com")
                    .phone("9876543211")
                    .passwordHash(passwordEncoder.encode("Doctor@123"))
                    .specialization("Cardiology")
                    .qualification("DM Cardiology, MD")
                    .registrationNumber("REG-40021")
                    .yearsExperience(12)
                    .consultationFee(BigDecimal.valueOf(1000.00))
                    .profileBio("Senior interventional cardiologist.")
                    .approvalStatus("approved")
                    .isServiceActive(true)
                    .isActive(true)
                    .workingHours("09:00 AM - 04:00 PM")
                    .availableDays("Mon, Wed, Fri")
                    .build();

            Doctor doc4 = Doctor.builder()
                    .fullName("Dr. Amit Sharma")
                    .email("amit@carecore.com")
                    .phone("9876543212")
                    .passwordHash(passwordEncoder.encode("Doctor@123"))
                    .specialization("General Medicine")
                    .qualification("MBBS, MD")
                    .registrationNumber("REG-10982")
                    .yearsExperience(10)
                    .consultationFee(BigDecimal.valueOf(500.00))
                    .profileBio("General physician & family medicine expert.")
                    .approvalStatus("approved")
                    .isServiceActive(true)
                    .isActive(true)
                    .workingHours("08:00 AM - 02:00 PM")
                    .availableDays("Everyday")
                    .build();

            Doctor doc5 = Doctor.builder()
                    .fullName("Dr. Neha Verma")
                    .email("neha@carecore.com")
                    .phone("9876543213")
                    .passwordHash(passwordEncoder.encode("Doctor@123"))
                    .specialization("Pediatrics")
                    .qualification("MD Pediatrics")
                    .registrationNumber("REG-30419")
                    .yearsExperience(8)
                    .consultationFee(BigDecimal.valueOf(800.00))
                    .profileBio("Child specialist and pediatric care expert.")
                    .approvalStatus("approved")
                    .isServiceActive(true)
                    .isActive(true)
                    .workingHours("10:00 AM - 05:00 PM")
                    .availableDays("Mon, Tue, Thu, Fri, Sat")
                    .build();

            doctorRepository.saveAll(List.of(doc1, doc2, doc3, doc4, doc5));
            System.out.println("✅ Seeded 5 Specialist Doctor Accounts (Including Dr. Sakshi Patel)");
        }

        // 3. Seed Realistic Patient Accounts & Tokens matching Screenshot (#024 NOW SERVING)
        if (patientRepository.count() == 0) {
            List<Patient> patients = new ArrayList<>();
            String[] names = {
                "Sakshi Sardhara", "Jia Patel", "Aarav Sharma", "Ananya Desai", "Rohan Mehta",
                "Priya Nair", "Vikram Singh", "Meera Joshi", "Kabir Malhotra", "Sneha Gupta"
            };
            String[] bloodGroups = {"B+", "A+", "O+", "AB+", "O-", "A-", "B+", "O+", "B-", "AB-"};

            for (int i = 0; i < names.length; i++) {
                Patient p = Patient.builder()
                        .fullName(names[i])
                        .age(22 + (i * 3))
                        .gender(i % 2 == 0 ? "female" : "male")
                        .contact("98234567" + (10 + i))
                        .email(names[i].toLowerCase().replace(" ", "") + "@gmail.com")
                        .bloodGroup(bloodGroups[i])
                        .medicalHistory(i % 3 == 0 ? "Hypertension" : "Routine Checkup")
                        .build();
                patients.add(p);
            }
            patientRepository.saveAll(patients);
            System.out.println("✅ Seeded 10 Patient Accounts");

            // Seed QueueState & Tokens for Dr. Sakshi Patel (Cardiology Board)
            Doctor drSakshi = doctorRepository.findAll().get(0);

            // QueueState: Current token #24 (NOW SERVING), 30 total tokens (6 waiting -> 75% capacity processed!)
            QueueState qs = QueueState.builder()
                    .queueDate(LocalDate.now())
                    .doctorId(drSakshi.getId())
                    .currentNumber(24)
                    .lastToken(30)
                    .lastAction("next")
                    .build();
            queueStateRepository.save(qs);

            List<Token> tokens = new ArrayList<>();
            // Completed tokens 1 to 23
            for (int t = 1; t <= 23; t++) {
                Token token = Token.builder()
                        .tokenNumber(t)
                        .tokenDate(LocalDate.now())
                        .doctor(drSakshi)
                        .patient(patients.get(t % patients.size()))
                        .status("completed")
                        .notes("Consultation completed successfully.")
                        .build();
                tokens.add(token);
            }

            // Token #024 — NOW SERVING (In Progress)
            Token token24 = Token.builder()
                    .tokenNumber(24)
                    .tokenDate(LocalDate.now())
                    .doctor(drSakshi)
                    .patient(patients.get(0)) // Sakshi Sardhara
                    .status("in_progress")
                    .notes("General Cardiology consultation - ECG Review")
                    .build();
            tokens.add(token24);

            // Waiting tokens 25 to 30 (6 Patients Waiting!)
            for (int w = 25; w <= 30; w++) {
                Token tokenW = Token.builder()
                        .tokenNumber(w)
                        .tokenDate(LocalDate.now())
                        .doctor(drSakshi)
                        .patient(patients.get(w % patients.size()))
                        .status("waiting")
                        .notes("Waiting for consultation")
                        .build();
                tokens.add(tokenW);
            }

            tokenRepository.saveAll(tokens);

            // Appointment for Token #024
            Appointment appt = Appointment.builder()
                    .token(token24)
                    .doctor(drSakshi)
                    .patient(patients.get(0))
                    .appointmentDate(LocalDate.now())
                    .appointmentTime(LocalTime.of(10, 30))
                    .status("in_progress")
                    .notes("General Cardiology Consultation & ECG Evaluation")
                    .build();
            appointmentRepository.save(appt);

            System.out.println("✅ Seeded Production Dataset: #024 NOW SERVING for Dr. Sakshi Patel, 6 Waiting Patients, 75% Capacity Processed!");
        }

        // 4. Seed Default Clinic Notices
        if (noticeRepository.count() == 0) {
            Notice globalNotice = Notice.builder()
                    .text("Care Core Clinic is operating normally. All consultation desks, diagnostic labs, and pharmacy counters are open.")
                    .isActive(true)
                    .createdAt(LocalDateTime.now())
                    .updatedAt(LocalDateTime.now())
                    .build();
            noticeRepository.save(globalNotice);
            System.out.println("✅ Seeded Default Broadcast Notice");
        }

        // 5. Seed Pharmacy Inventory Stock
        if (inventoryRepository.count() == 0) {
            List<InventoryItem> items = List.of(
                    InventoryItem.builder().itemName("Paracetamol 650mg").category("Tablet").dosage("650mg").quantity(250).minThreshold(30).unitPrice(BigDecimal.valueOf(2.50)).manufacturer("Cipla Ltd").batchNumber("BAT-PCM01").build(),
                    InventoryItem.builder().itemName("Amoxicillin 500mg").category("Capsule").dosage("500mg").quantity(120).minThreshold(25).unitPrice(BigDecimal.valueOf(8.00)).manufacturer("Sun Pharma").batchNumber("BAT-AMX02").build(),
                    InventoryItem.builder().itemName("Metformin 500mg").category("Tablet").dosage("500mg").quantity(180).minThreshold(30).unitPrice(BigDecimal.valueOf(4.00)).manufacturer("Abbott").batchNumber("BAT-MET03").build(),
                    InventoryItem.builder().itemName("Amlodipine 5mg").category("Tablet").dosage("5mg").quantity(140).minThreshold(20).unitPrice(BigDecimal.valueOf(3.50)).manufacturer("Torrent Pharma").batchNumber("BAT-AML04").build(),
                    InventoryItem.builder().itemName("Pantoprazole 40mg").category("Tablet").dosage("40mg").quantity(160).minThreshold(25).unitPrice(BigDecimal.valueOf(7.00)).manufacturer("Alkem Labs").batchNumber("BAT-PAN05").build(),
                    InventoryItem.builder().itemName("Cetirizine 10mg").category("Tablet").dosage("10mg").quantity(200).minThreshold(30).unitPrice(BigDecimal.valueOf(2.00)).manufacturer("Dr. Reddy's").batchNumber("BAT-CET06").build(),
                    InventoryItem.builder().itemName("Azithromycin 500mg").category("Tablet").dosage("500mg").quantity(80).minThreshold(20).unitPrice(BigDecimal.valueOf(18.00)).manufacturer("Lupin").batchNumber("BAT-AZI07").build(),
                    InventoryItem.builder().itemName("ORS Sachet").category("Consumable").dosage("21.8g").quantity(300).minThreshold(50).unitPrice(BigDecimal.valueOf(15.00)).manufacturer("FDC Ltd").batchNumber("BAT-ORS08").build()
            );
            inventoryRepository.saveAll(items);
            System.out.println("✅ Seeded 8 Pharmacy Medicine Inventory Items");
        }

        // 6. Seed Bills Ledger
        if (billRepository.count() == 0) {
            List<Bill> bills = List.of(
                    Bill.builder().patientId(1L).patientName("Sakshi Sardhara").doctorId(1L).doctorName("Dr. Sakshi Patel").tokenNumber(24).amount(BigDecimal.valueOf(1200.00)).paymentStatus("paid").paymentMethod("UPI/QR").description("Cardiology Consultation & ECG").paidAt(LocalDateTime.now()).build(),
                    Bill.builder().patientId(2L).patientName("Jia Patel").doctorId(1L).doctorName("Dr. Sakshi Patel").tokenNumber(25).amount(BigDecimal.valueOf(500.00)).paymentStatus("pending").description("Routine Followup").build(),
                    Bill.builder().patientId(3L).patientName("Aarav Sharma").doctorId(1L).doctorName("Dr. Sakshi Patel").tokenNumber(26).amount(BigDecimal.valueOf(850.00)).paymentStatus("paid").paymentMethod("Cash").description("Consultation + Lab Screen").paidAt(LocalDateTime.now()).build()
            );
            billRepository.saveAll(bills);
            System.out.println("✅ Seeded Initial Billing Records");
        }
    }
}
