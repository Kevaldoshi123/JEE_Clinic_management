package com.medeuon.clinic.repositories;

import com.medeuon.clinic.models.Notice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NoticeRepository extends JpaRepository<Notice, Long> {
    Optional<Notice> findTopByDoctorIdOrderByUpdatedAtDesc(Long doctorId);
    Optional<Notice> findTopByDoctorIdIsNullOrderByUpdatedAtDesc();
    List<Notice> findByIsActiveTrueOrderByUpdatedAtDesc();
}
