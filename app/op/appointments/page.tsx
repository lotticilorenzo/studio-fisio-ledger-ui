'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { EmptyState, emptyStates } from '@/components/EmptyState';

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

function statusLabel(s: string) {
  if (s === 'scheduled') return 'Programmato';
  if (s === 'completed') return 'Completato';
  if (s === 'cancelled') return 'Disdetto';
  if (s === 'no_show') return 'Non presentato';
  return s;
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

    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) {
      router.replace('/login');
      return;
    }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filtro client-side
  const filteredRows = useMemo(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return rows.filter((r) => {
      const appointmentDate = new Date(r.starts_at);
      if (filter === 'today') return isSameDay(appointmentDate, today);
      if (filter === 'tomorrow') return isSameDay(appointmentDate, tomorrow);
      return true; // 'all'
    });
  }, [rows, filter]);

  const totalLordoCents = useMemo(
    () => filteredRows.reduce((acc, r) => acc + (r.gross_amount_cents ?? 0), 0),
    [filteredRows]
  );

  return (
    <main className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <h1 className="text-xl md:text-2xl font-semibold">I miei appuntamenti</h1>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => router.push('/op/appointments/new')}
            className="btn btn-primary"
          >
            + Nuovo
          </button>
          <button onClick={load} className="btn btn-secondary">
            ↻
          </button>
        </div>
      </div>

      {/* Filtri */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setFilter('today')}
          className={`btn whitespace-nowrap ${filter === 'today' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Oggi
        </button>
        <button
          onClick={() => setFilter('tomorrow')}
          className={`btn whitespace-nowrap ${filter === 'tomorrow' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Domani
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`btn whitespace-nowrap ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Tutti (50)
        </button>
      </div>

      {/* Totale */}
      <div className="mt-4 text-sm">
        Totale lordo: <b>{eur(totalLordoCents)}</b> ({filteredRows.length} appuntamenti)
      </div>

      {/* Loading/Error */}
      {loading && <div className="mt-6 text-center py-8">Carico…</div>}
      {error && <div className="mt-6 text-red-400">Errore: {error}</div>}

      {/* Lista Card (mobile-first) */}
      {!loading && !error && (
        <div className="mt-4 space-y-3">
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
                className={`border rounded-lg p-4 cursor-pointer hover:bg-white/5 transition ${r.status === 'cancelled' ? 'opacity-50' : ''}`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{r.patient_name ?? 'Paziente'}</div>
                    <div className="text-sm opacity-70">{r.service_name ?? 'Servizio'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{eur(r.gross_amount_cents ?? 0)}</div>
                    <div className={`text-xs px-2 py-0.5 rounded ${r.status === 'completed' ? 'bg-green-600' :
                      r.status === 'cancelled' ? 'bg-red-600' :
                        r.status === 'scheduled' ? 'bg-blue-600' : 'bg-gray-600'
                      }`}>
                      {statusLabel(r.status)}
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-sm opacity-70">
                  📅 {formatDateIT(r.starts_at)}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </main>
  );
}
