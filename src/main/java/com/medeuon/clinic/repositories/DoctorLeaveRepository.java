package com.medeuon.clinic.repositories;

import com.medeuon.clinic.models.DoctorLeave;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DoctorLeaveRepository extends JpaRepository<DoctorLeave, Long> {
    List<DoctorLeave> findByDoctorIdOrderByStartDateDesc(Long doctorId);
}
