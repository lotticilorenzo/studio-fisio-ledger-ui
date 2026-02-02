SELECT count(*) as total, count(patient_id) as with_id, count(*) - count(patient_id) as missing_id FROM appointments;
