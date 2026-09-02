package com.medeuon.clinic.repositories;

import com.medeuon.clinic.models.Token;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface TokenRepository extends JpaRepository<Token, Long> {
    List<Token> findByTokenDateAndDoctorIdOrderByTokenNumberAsc(LocalDate tokenDate, Long doctorId);
    List<Token> findByTokenDateAndPatientId(LocalDate tokenDate, Long patientId);
    
    @Query("SELECT MAX(t.tokenNumber) FROM Token t WHERE t.tokenDate = :date AND t.doctor.id = :doctorId")
    Optional<Integer> findMaxTokenNumberByDateAndDoctorId(@Param("date") LocalDate date, @Param("doctorId") Long doctorId);

    List<Token> findByTokenDateAndDoctorIdAndStatus(LocalDate tokenDate, Long doctorId, String status);
}
