package com.medeuon.clinic.repositories;

import com.medeuon.clinic.models.LabOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LabOrderRepository extends JpaRepository<LabOrder, Long> {
    List<LabOrder> findByDoctorIdOrderByOrderedAtDesc(Long doctorId);
    List<LabOrder> findByPatientIdOrderByOrderedAtDesc(Long patientId);
    List<LabOrder> findByStatusOrderByOrderedAtDesc(String status);
}
