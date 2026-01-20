'use client';

import { useEffect, useMemo, useState } from 'react';
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

function eur(cents: number) {
  return `€${((cents ?? 0) / 100).toFixed(2)}`;
}

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

  async function load() {
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
  }

  useEffect(() => {
    load();
  }, []);

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

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">I miei appuntamenti</h1>
        <button
          onClick={load}
          className="btn btn-icon btn-ghost"
          aria-label="Ricarica"
        >
          ↻
        </button>
      </div>

      {/* Filter Pills */}
      <div className="filter-pills mb-4">
        <button
          onClick={() => setFilter('today')}
          className={`filter-pill ${filter === 'today' ? 'active' : ''}`}
        >
          📅 Oggi
        </button>
        <button
          onClick={() => setFilter('tomorrow')}
          className={`filter-pill ${filter === 'tomorrow' ? 'active' : ''}`}
        >
          🗓️ Domani
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`filter-pill ${filter === 'all' ? 'active' : ''}`}
        >
          📋 Tutti
        </button>
      </div>

      {/* Stats */}
      <div className="stats-box mb-4">
        <span className="text-sm text-secondary">Totale:</span>
        <span className="stats-value">{eur(totalLordoCents)}</span>
        <span className="text-xs text-muted">({filteredRows.length})</span>
      </div>

      {/* Loading */}
      {loading && <LoadingState />}

      {/* Error */}
      {error && (
        <div className="error-box mb-4">
          ⚠️ Errore: {error}
        </div>
      )}

      {/* List */}
      {!loading && !error && (
        <div className="space-y-3 has-bottom-nav" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {filteredRows.length === 0 ? (
            <EmptyState
              {...(filter === 'today' ? emptyStates.noAppointmentsToday :
                filter === 'tomorrow' ? emptyStates.noAppointmentsTomorrow :
                  emptyStates.noAppointments)}
              action={
                <button
                  onClick={() => router.push('/op/appointments/new')}
                  className="btn btn-primary"
                >
                  + Nuovo Appuntamento
                </button>
              }
            />
          ) : (
            filteredRows.map((r) => (
              <div
                key={r.id}
                onClick={() => router.push(`/op/appointments/${r.id}`)}
                className={`appointment-card ${r.status === 'cancelled' ? 'opacity-50' : ''}`}
                style={{ opacity: r.status === 'cancelled' ? 0.5 : 1 }}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1" style={{ minWidth: 0 }}>
                    <div className="font-semibold truncate">{r.patient_name ?? 'Paziente'}</div>
                    <div className="text-sm text-muted truncate">{r.service_name ?? 'Servizio'}</div>
                  </div>
                  <div className="text-right" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--space-1)' }}>
                    <div className="font-bold text-accent">{eur(r.gross_amount_cents ?? 0)}</div>
                    <Badge status={r.status} />
                  </div>
                </div>
                <div className="mt-3 text-sm text-muted flex items-center gap-1">
                  <span>🕐</span>
                  <span>{formatDateIT(r.starts_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => router.push('/op/appointments/new')}
        className="fab"
        aria-label="Nuovo appuntamento"
      >
        +
      </button>
    </div>
  );
}
