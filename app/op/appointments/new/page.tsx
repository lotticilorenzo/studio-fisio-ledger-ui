'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { humanError } from '@/lib/humanError';
import { LoadingState, Spinner } from '@/components/ui/Loading';

type Service = { id: string; name: string };

export default function OpNewAppointmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [services, setServices] = useState<Service[]>([]);

  const [startsAt, setStartsAt] = useState<string>(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  const [serviceId, setServiceId] = useState<string>('');
  const [patientName, setPatientName] = useState<string>('');
  const [grossEuro, setGrossEuro] = useState<string>('80');
  const [notes, setNotes] = useState<string>('');
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(true);

  const grossCents = useMemo(() => {
    const n = Number(String(grossEuro).replace(',', '.'));
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }, [grossEuro]);

  useEffect(() => {
    (async () => {
      setErr(null);
      const { data, error } = await supabase.rpc('get_my_services_op');
      if (error) setErr(humanError(error.message));
      else setServices((data ?? []) as Service[]);
      setServicesLoading(false);
    })();
  }, []);

  async function save() {
    setLoading(true);
    setErr(null);

    if (!patientName.trim()) {
      setErr('Inserisci almeno il nome del paziente.');
      setLoading(false);
      return;
    }
    if (!serviceId) {
      setErr('Seleziona un servizio.');
      setLoading(false);
      return;
    }
    if (grossCents <= 0) {
      setErr('Inserisci un importo valido.');
      setLoading(false);
      return;
    }
    const appointmentDate = new Date(startsAt);
    if (appointmentDate < new Date()) {
      setErr('Non puoi creare un appuntamento nel passato.');
      setLoading(false);
      return;
    }

    const { error } = await supabase.rpc('op_create_appointment', {
      p_service_id: serviceId,
      p_starts_at: new Date(startsAt).toISOString(),
      p_patient_full_name: patientName.trim(),
      p_gross_amount_cents: grossCents,
      p_notes: notes || null,
      p_marketing_consent: marketingConsent,
    });

    if (error) {
      setErr(humanError(error.message));
      setLoading(false);
      return;
    }

    router.replace('/op/appointments');
  }

  if (servicesLoading) {
    return <LoadingState />;
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Nuovo appuntamento</h1>
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
          <label className="form-label">🏷️ Servizio</label>
          <select
            className="form-input form-select"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
          >
            <option value="">Seleziona un servizio...</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">👤 Nome paziente</label>
          <input
            className="form-input"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            placeholder="Es. Maria Rossi"
          />
        </div>

        <div className="form-group flex items-center gap-3">
          <input
            type="checkbox"
            id="marketingConsentOp"
            checked={marketingConsent}
            onChange={(e) => setMarketingConsent(e.target.checked)}
            className="form-checkbox"
          />
          <label htmlFor="marketingConsentOp" className="text-sm text-secondary">
            Consenso comunicazioni marketing
          </label>
        </div>

        <div className="form-group">
          <label className="form-label">💰 Importo (€)</label>
          <input
            className="form-input"
            value={grossEuro}
            onChange={(e) => setGrossEuro(e.target.value)}
            inputMode="decimal"
            placeholder="80"
          />
        </div>

        <div className="form-group">
          <label className="form-label">📝 Note (opzionale)</label>
          <textarea
            className="form-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Aggiungi note..."
          />
        </div>

        <button
          onClick={save}
          disabled={loading}
          className="btn btn-primary btn-full btn-lg mt-2"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Spinner size="sm" />
              Salvataggio...
            </span>
          ) : (
            '✓ Salva appuntamento'
          )}
        </button>
      </div>
    </div>
  );
}
