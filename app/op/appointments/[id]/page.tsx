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

  // Styles
  const pageStyle: React.CSSProperties = { padding: '16px' };
  const headerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' };
  const titleStyle: React.CSSProperties = { fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Poppins, sans-serif' };
  const backBtn: React.CSSProperties = { background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', color: '#64748b', fontSize: '0.875rem' };
  const cardStyle: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' };
  const labelStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', fontWeight: 500, color: '#475569', marginBottom: '6px' };
  const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '1rem', minHeight: '48px', marginBottom: '16px' };
  const disabledInput: React.CSSProperties = { ...inputStyle, background: '#f1f5f9', color: '#64748b' };
  const selectStyle: React.CSSProperties = { ...inputStyle, appearance: 'none', background: '#fff url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2394a3b8\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E") no-repeat right 12px center', paddingRight: '40px' };
  const hintStyle: React.CSSProperties = { fontSize: '0.75rem', color: '#94a3b8', marginTop: '-12px', marginBottom: '16px' };
  const btnPrimary: React.CSSProperties = { width: '100%', background: 'linear-gradient(135deg, #f4f119 0%, #ff9900 100%)', color: '#0f172a', border: 'none', borderRadius: '8px', padding: '14px 20px', fontWeight: 600, cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px' };
  const btnDanger: React.CSSProperties = { width: '100%', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '8px', padding: '14px 20px', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' };
  const errorBox: React.CSSProperties = { background: '#fee2e2', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px', color: '#991b1b', marginBottom: '16px', fontSize: '0.875rem' };

  if (loading) {
    return <div style={pageStyle}><LoadingState /></div>;
  }

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Modifica appuntamento</h1>
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

        <label style={labelStyle}>👤 Paziente</label>
        <input style={disabledInput} value={patientName} disabled />
        <p style={hintStyle}>Il nome paziente non può essere modificato</p>

        <label style={labelStyle}>🏷️ Servizio</label>
        <select style={selectStyle} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          <option value="">Nessun servizio</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <label style={labelStyle}>📊 Stato</label>
        <select style={selectStyle} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="scheduled">In programma</option>
          <option value="completed">Completato</option>
          <option value="no_show">Assente</option>
          <option value="cancelled">Disdetto</option>
        </select>

        <label style={labelStyle}>💰 Importo (€)</label>
        <input
          style={inputStyle}
          value={grossEuro}
          onChange={(e) => setGrossEuro(e.target.value)}
          inputMode="decimal"
        />

        <label style={labelStyle}>📝 Note</label>
        <textarea
          style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Aggiungi note..."
        />

        <button onClick={save} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>
          {saving ? <><Spinner size="sm" /> Salvataggio...</> : '✓ Salva modifiche'}
        </button>

        <button onClick={cancel} disabled={saving} style={{ ...btnDanger, opacity: saving ? 0.7 : 1 }}>
          ✕ Disdici appuntamento
        </button>
      </div>
    </div>
  );
}
