package com.medeuon.clinic.repositories;

import com.medeuon.clinic.models.Bill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface BillRepository extends JpaRepository<Bill, Long> {
    List<Bill> findByDoctorIdOrderByCreatedAtDesc(Long doctorId);
    List<Bill> findByPatientIdOrderByCreatedAtDesc(Long patientId);
    List<Bill> findByPaymentStatusOrderByCreatedAtDesc(String paymentStatus);
    List<Bill> findByCreatedAtBetweenOrderByCreatedAtDesc(LocalDateTime start, LocalDateTime end);
}
