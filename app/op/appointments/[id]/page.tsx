'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { humanError } from '@/lib/humanError';
import { LoadingState, Spinner } from '@/components/ui/Loading';

type Service = { id: string; name: string };

export default function OpEditAppointmentPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [startsAt, setStartsAt] = useState<string>('');
  const [serviceId, setServiceId] = useState<string>('');
  const [patientName, setPatientName] = useState<string>('');
  const [grossEuro, setGrossEuro] = useState<string>('0');
  const [notes, setNotes] = useState<string>('');
  const [status, setStatus] = useState<string>('scheduled');

  const grossCents = useMemo(() => {
    const n = Number(String(grossEuro).replace(',', '.'));
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }, [grossEuro]);

  function toDatetimeLocal(iso: string) {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  useEffect(() => {
    (async () => {
      setErr(null);

      const { data: servicesData, error: servicesError } = await supabase.rpc('get_my_services_op');
      if (servicesError) {
        setErr(humanError(servicesError.message));
        setLoading(false);
        return;
      }
      setServices((servicesData ?? []) as Service[]);

      const { data, error } = await supabase.rpc('get_appointment_by_id_op', { p_id: id });
      if (error) {
        setErr(humanError(error.message));
        setLoading(false);
        return;
      }

      const found = Array.isArray(data) && data.length > 0 ? data[0] : null;
      if (!found) {
        setErr('Appuntamento non trovato o non autorizzato.');
        setLoading(false);
        return;
      }

      setStartsAt(toDatetimeLocal(found.starts_at));
      setServiceId(found.service_id ?? '');
      setGrossEuro(((found.gross_amount_cents ?? 0) / 100).toFixed(2));
      setNotes(found.notes ?? '');
      setStatus(found.status ?? 'scheduled');
      setPatientName(found.patient_name ?? '');
      setLoading(false);
    })();
  }, [id]);

  async function save() {
    if (!id) return;
    setSaving(true);
    setErr(null);

    const { error } = await supabase.rpc('op_update_appointment', {
      p_appointment_id: id,
      p_starts_at: new Date(startsAt).toISOString(),
      p_status: status,
      p_gross_amount_cents: grossCents,
      p_notes: notes || null,
      p_service_id: serviceId || null,
    });

    if (error) {
      setErr(humanError(error.message));
      setSaving(false);
      return;
    }

    router.replace('/op/appointments');
  }

  async function cancel() {
    if (!id) return;

    const conferma = window.confirm('Sei sicuro di voler disdire questo appuntamento?\n\nQuesta azione non può essere annullata.');
    if (!conferma) return;

    setSaving(true);
    setErr(null);

    const { error } = await supabase.rpc('op_cancel_appointment', { p_appointment_id: id });

    if (error) {
      setErr(humanError(error.message));
      setSaving(false);
      return;
    }

    router.replace('/op/appointments');
  }

  if (loading) {
    return <LoadingState />;
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Modifica appuntamento</h1>
        <button className="btn btn-ghost btn-sm" onClick={() => router.back()}>
          ← Indietro
        </button>
      </div>

      {err && (
        <div className="error-box mb-4">
          ⚠️ {err}
        </div>
      )}

      <div className="card card-body">
        <div className="form-group">
          <label className="form-label">📅 Data e ora</label>
          <input
            type="datetime-local"
            className="form-input"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">👤 Paziente</label>
          <input
            className="form-input"
            value={patientName}
            disabled
            style={{ background: 'var(--bg-tertiary)' }}
          />
          <p className="form-hint">Il nome paziente non può essere modificato</p>
        </div>

        <div className="form-group">
          <label className="form-label">🏷️ Servizio</label>
          <select
            className="form-input form-select"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
          >
            <option value="">Nessun servizio</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">📊 Stato</label>
          <select
            className="form-input form-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="scheduled">In programma</option>
            <option value="completed">Completato</option>
            <option value="no_show">Assente</option>
            <option value="cancelled">Disdetto</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">💰 Importo (€)</label>
          <input
            className="form-input"
            value={grossEuro}
            onChange={(e) => setGrossEuro(e.target.value)}
            inputMode="decimal"
          />
        </div>

        <div className="form-group">
          <label className="form-label">📝 Note</label>
          <textarea
            className="form-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Aggiungi note..."
          />
        </div>

        <div className="mt-4" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <button
            onClick={save}
            disabled={saving}
            className="btn btn-primary btn-full"
          >
            {saving ? <><Spinner size="sm" /> Salvataggio...</> : '✓ Salva modifiche'}
          </button>

          <button
            onClick={cancel}
            disabled={saving}
            className="btn btn-danger btn-full"
          >
            ✕ Disdici appuntamento
          </button>
        </div>
      </div>
    </div>
  );
}
