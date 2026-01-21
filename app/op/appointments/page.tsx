'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { EmptyState, emptyStates } from '@/components/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/Loading';

type Row = {
  id: string;
  starts_at: string;
  status: string;
  operator_name: string | null;
  service_name: string | null;
  patient_name: string | null;
  gross_amount_cents: number;
};

type FilterType = 'today' | 'tomorrow' | 'all';

import { eur } from '@/lib/format';

function formatDateIT(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('it-IT', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isSameDay(date1: Date, date2: Date) {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

export default function OperatorAppointmentsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('today');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.rpc('get_my_appointments_op', { p_limit: 50 });

    if (error) {
      setError(error.message);
      setRows([]);
    } else {
      setRows((data ?? []) as Row[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return rows.filter((r) => {
      const appointmentDate = new Date(r.starts_at);
      if (filter === 'today') return isSameDay(appointmentDate, today);
      if (filter === 'tomorrow') return isSameDay(appointmentDate, tomorrow);
      return true;
    });
  }, [rows, filter]);

  const totalLordoCents = useMemo(
    () => filteredRows.reduce((acc, r) => acc + (r.gross_amount_cents ?? 0), 0),
    [filteredRows]
  );

  // Styles
  const pageStyle: React.CSSProperties = { padding: '16px', paddingBottom: '100px' };
  const headerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' };
  const titleStyle: React.CSSProperties = { fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Poppins, sans-serif' };
  const refreshBtn: React.CSSProperties = { background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', fontSize: '1.25rem', color: '#64748b' };
  const pillsContainer: React.CSSProperties = { display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto' };
  const pillStyle = (active: boolean): React.CSSProperties => ({
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    minHeight: '40px',
    padding: '8px 16px',
    fontSize: '0.875rem',
    fontWeight: active ? 600 : 500,
    color: active ? '#0f172a' : '#64748b',
    background: active ? 'linear-gradient(135deg, #f4f119 0%, #ff9900 100%)' : '#fff',
    border: active ? 'none' : '1.5px solid #e2e8f0',
    borderRadius: '20px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  });
  const statsBox: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, rgba(244,241,25,0.1) 0%, rgba(255,153,0,0.1) 100%)', border: '1px solid rgba(244,241,25,0.3)', borderRadius: '10px', padding: '10px 16px', marginBottom: '16px' };
  const statsValue: React.CSSProperties = { fontWeight: 700, color: '#ff9900' };
  const cardStyle: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '12px', cursor: 'pointer', position: 'relative', overflow: 'hidden' };
  const cardBorder: React.CSSProperties = { position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: 'linear-gradient(180deg, #f4f119 0%, #ff9900 100%)' };
  const patientName: React.CSSProperties = { fontWeight: 600, fontSize: '1rem', color: '#0f172a' };
  const serviceName: React.CSSProperties = { fontSize: '0.875rem', color: '#64748b' };
  const amountStyle: React.CSSProperties = { fontWeight: 700, fontSize: '1.125rem', color: '#ff9900' };
  const timeStyle: React.CSSProperties = { fontSize: '0.875rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '12px' };
  const fabStyle: React.CSSProperties = { position: 'fixed', bottom: '24px', right: '16px', width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #f4f119 0%, #ff9900 100%)', color: '#0f172a', fontSize: '1.5rem', fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(244,241,25,0.4)', zIndex: 30 };
  const errorBox: React.CSSProperties = { background: '#fee2e2', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '16px', color: '#991b1b', marginBottom: '16px' };

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h1 style={titleStyle}>I miei appuntamenti</h1>
        <button onClick={load} style={refreshBtn} aria-label="Ricarica">↻</button>
      </div>

      {/* Filter Pills */}
      <div style={pillsContainer}>
        <button onClick={() => setFilter('today')} style={pillStyle(filter === 'today')}>📅 Oggi</button>
        <button onClick={() => setFilter('tomorrow')} style={pillStyle(filter === 'tomorrow')}>🗓️ Domani</button>
        <button onClick={() => setFilter('all')} style={pillStyle(filter === 'all')}>📋 Tutti</button>
      </div>

      {/* Stats */}
      <div style={statsBox}>
        <span style={{ fontSize: '0.875rem', color: '#475569' }}>Totale:</span>
        <span style={statsValue}>{eur(totalLordoCents)}</span>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>({filteredRows.length})</span>
      </div>

      {/* Loading */}
      {loading && <LoadingState />}

      {/* Error */}
      {error && <div style={errorBox}>⚠️ Errore: {error}</div>}

      {/* List */}
      {!loading && !error && (
        <>
          {filteredRows.length === 0 ? (
            <EmptyState
              {...(filter === 'today' ? emptyStates.noAppointmentsToday :
                filter === 'tomorrow' ? emptyStates.noAppointmentsTomorrow :
                  emptyStates.noAppointments)}
              action={
                <button onClick={() => router.push('/op/appointments/new')} style={{ background: 'linear-gradient(135deg, #f4f119 0%, #ff9900 100%)', color: '#0f172a', border: 'none', borderRadius: '8px', padding: '12px 20px', fontWeight: 600, cursor: 'pointer' }}>
                  + Nuovo Appuntamento
                </button>
              }
            />
          ) : (
            filteredRows.map((r) => (
              <div
                key={r.id}
                onClick={() => router.push(`/op/appointments/${r.id}`)}
                style={{ ...cardStyle, opacity: r.status === 'cancelled' ? 0.5 : 1 }}
              >
                <div style={cardBorder} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', paddingLeft: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={patientName}>{r.patient_name ?? 'Paziente'}</div>
                    <div style={serviceName}>{r.service_name ?? 'Servizio'}</div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <div style={amountStyle}>{eur(r.gross_amount_cents ?? 0)}</div>
                    <Badge status={r.status} />
                  </div>
                </div>
                <div style={{ ...timeStyle, paddingLeft: '12px' }}>
                  <span>🕐</span>
                  <span>{formatDateIT(r.starts_at)}</span>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* FAB */}
      <button onClick={() => router.push('/op/appointments/new')} style={fabStyle} aria-label="Nuovo appuntamento">
        +
      </button>
    </div>
  );
}
