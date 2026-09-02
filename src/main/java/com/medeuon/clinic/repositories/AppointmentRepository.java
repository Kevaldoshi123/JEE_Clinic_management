package com.medeuon.clinic.repositories;

import com.medeuon.clinic.models.Appointment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface AppointmentRepository extends JpaRepository<Appointment, Long> {
    List<Appointment> findByAppointmentDateAndDoctorId(LocalDate appointmentDate, Long doctorId);
    List<Appointment> findByDoctorId(Long doctorId);
    List<Appointment> findByPatientId(Long patientId);
    List<Appointment> findByAppointmentDateAndPatientId(LocalDate appointmentDate, Long patientId);
}
