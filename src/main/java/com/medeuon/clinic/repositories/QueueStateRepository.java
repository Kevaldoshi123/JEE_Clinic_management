package com.medeuon.clinic.repositories;

import com.medeuon.clinic.models.QueueState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface QueueStateRepository extends JpaRepository<QueueState, Long> {
    Optional<QueueState> findByQueueDateAndDoctorId(LocalDate queueDate, Long doctorId);
}
