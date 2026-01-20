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
  const [servicesLoading, setServicesLoading] = useState(true);

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

  // Styles
  const pageStyle: React.CSSProperties = { padding: '16px' };
  const headerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' };
  const titleStyle: React.CSSProperties = { fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Poppins, sans-serif' };
  const backBtn: React.CSSProperties = { background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', color: '#64748b', fontSize: '0.875rem' };
  const cardStyle: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' };
  const labelStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', fontWeight: 500, color: '#475569', marginBottom: '6px' };
  const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '1rem', minHeight: '48px', marginBottom: '16px' };
  const selectStyle: React.CSSProperties = { ...inputStyle, appearance: 'none', background: '#fff url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2394a3b8\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E") no-repeat right 12px center', paddingRight: '40px' };
  const checkboxRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' };
  const checkboxStyle: React.CSSProperties = { width: '20px', height: '20px', accentColor: '#ff9900' };
  const btnPrimary: React.CSSProperties = { width: '100%', background: 'linear-gradient(135deg, #f4f119 0%, #ff9900 100%)', color: '#0f172a', border: 'none', borderRadius: '8px', padding: '14px 20px', fontWeight: 600, cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' };
  const errorBox: React.CSSProperties = { background: '#fee2e2', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px', color: '#991b1b', marginBottom: '16px', fontSize: '0.875rem' };

  if (servicesLoading) {
    return <div style={pageStyle}><LoadingState /></div>;
  }

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Nuovo appuntamento</h1>
        <button onClick={() => router.back()} style={backBtn}>← Indietro</button>
      </div>

      {err && <div style={errorBox}>⚠️ {err}</div>}

      <div style={cardStyle}>
        <label style={labelStyle}>📅 Data e ora</label>
        <input
          type="datetime-local"
          style={inputStyle}
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
        />

        <label style={labelStyle}>🏷️ Servizio</label>
        <select style={selectStyle} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          <option value="">Seleziona un servizio...</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <label style={labelStyle}>👤 Nome paziente</label>
        <input
          style={inputStyle}
          value={patientName}
          onChange={(e) => setPatientName(e.target.value)}
          placeholder="Es. Maria Rossi"
        />

        <div style={checkboxRow}>
          <input
            type="checkbox"
            id="marketingConsentOp"
            checked={marketingConsent}
            onChange={(e) => setMarketingConsent(e.target.checked)}
            style={checkboxStyle}
          />
          <label htmlFor="marketingConsentOp" style={{ fontSize: '0.875rem', color: '#64748b' }}>
            Consenso comunicazioni marketing
          </label>
        </div>

        <label style={labelStyle}>💰 Importo (€)</label>
        <input
          style={inputStyle}
          value={grossEuro}
          onChange={(e) => setGrossEuro(e.target.value)}
          inputMode="decimal"
          placeholder="80"
        />

        <label style={labelStyle}>📝 Note (opzionale)</label>
        <textarea
          style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Aggiungi note..."
        />

        <button onClick={save} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.7 : 1 }}>
          {loading ? <><Spinner size="sm" /> Salvataggio...</> : '✓ Salva appuntamento'}
        </button>
      </div>
    </div>
  );
}
