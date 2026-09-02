package com.medeuon.clinic.repositories;

import com.medeuon.clinic.models.Patient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface PatientRepository extends JpaRepository<Patient, Long> {
    Optional<Patient> findByUniqueId(String uniqueId);
    List<Patient> findByContact(String contact);
    List<Patient> findByFullNameContainingIgnoreCase(String fullName);
}
