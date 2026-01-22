'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { EmptyState, emptyStates } from '@/components/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/Loading';
import { eur } from '@/lib/format';

type Row = {
  res_id: string;
  res_starts_at: string;
  res_status: string;
  res_operator_name: string | null;
  res_service_name: string | null;
  res_patient_name: string | null;
  res_gross_amount_cents: number;
  res_duration_minutes?: number;
};

type FilterType = 'today' | 'tomorrow' | 'all';

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
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isAgendaView, setIsAgendaView] = useState(false);
  const agendaContainerRef = useRef<HTMLDivElement>(null);

  // Generate 14 days for the strip
  const dateStrip = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc('get_my_appointments_op', { p_limit: 100 });
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
    if (filter === 'all') return rows;

    return rows.filter((r) => {
      const appointmentDate = new Date(r.res_starts_at);
      return isSameDay(appointmentDate, selectedDate);
    });
  }, [rows, filter, selectedDate]);

  // Auto-scroll to first appointment
  useEffect(() => {
    if (isAgendaView && agendaContainerRef.current && filteredRows.length > 0) {
      const sorted = [...filteredRows].sort((a, b) => new Date(a.res_starts_at).getTime() - new Date(b.res_starts_at).getTime());
      const first = sorted[0];
      const d = new Date(first.res_starts_at);
      const h = d.getHours();
      const m = d.getMinutes();

      if (h >= 8) {
        const scrollPos = (h - 8) * 48 + (m / 60) * 48 - 40; // 48 is hourHeight, -40 for padding
        agendaContainerRef.current.scrollTo({ top: Math.max(0, scrollPos), behavior: 'smooth' });
      }
    }
  }, [isAgendaView, filteredRows]);

  const totalLordoCents = useMemo(
    () => filteredRows.reduce((acc, r) => acc + (r.res_gross_amount_cents ?? 0), 0),
    [filteredRows]
  );

  // Agenda View Helpers
  const timeSlots = Array.from({ length: 13 }, (_, i) => 8 + i); // 8:00 to 20:00
  const hourHeight = 48; // COMPACT HEIGHT

  const getPosition = (isoDate: string) => {
    const d = new Date(isoDate);
    const h = d.getHours();
    const m = d.getMinutes();
    if (h < 8) return 0;
    return (h - 8) * hourHeight + (m / 60) * hourHeight;
  };

  const getHeight = (duration: number = 60) => {
    return (duration / 60) * hourHeight;
  };

  return (
    <div className="p-4 md:p-6 pb-24 space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900 font-[Poppins]">I miei appuntamenti</h1>
        <button onClick={load} className="p-2 text-slate-400 hover:text-slate-900 transition-colors" aria-label="Ricarica">↻</button>
      </header>

      {/* Primary Navigation & Controls */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar scroll-smooth">
          <button
            onClick={() => {
              setFilter('all');
              setIsAgendaView(false);
            }}
            className={`flex-shrink-0 px-5 py-3 rounded-2xl text-sm font-bold transition-all border ${filter === 'all'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md'
              : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
              }`}
          >
            📋 Tutti
          </button>

          <div className="w-px h-8 bg-slate-200 flex-shrink-0" />

          {dateStrip.map((d) => {
            const isActive = filter !== 'all' && isSameDay(d, selectedDate);
            const isToday = isSameDay(d, new Date());
            return (
              <button
                key={d.toISOString()}
                onClick={() => {
                  setFilter('today'); // Mode indicating single day selection
                  setSelectedDate(d);
                }}
                className={`flex-shrink-0 flex flex-col items-center justify-center min-w-[64px] h-[72px] rounded-2xl border transition-all ${isActive
                  ? 'bg-gradient-to-br from-yellow-300 to-orange-400 border-orange-400 text-slate-900 shadow-lg scale-105 z-10'
                  : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'
                  }`}
              >
                <span className={`text-[10px] uppercase font-bold ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                  {d.toLocaleDateString('it-IT', { weekday: 'short' })}
                </span>
                <span className="text-xl font-black">
                  {d.getDate()}
                </span>
                {isToday && !isActive && <div className="w-1 h-1 bg-orange-400 rounded-full mt-0.5" />}
              </button>
            );
          })}
        </div>

        {filter !== 'all' && (
          <div className="flex justify-between items-center bg-slate-100 p-1 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
            <button
              onClick={() => setIsAgendaView(false)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${!isAgendaView ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              ☰ Lista
            </button>
            <button
              onClick={() => setIsAgendaView(true)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${isAgendaView ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              🕘 Agenda
            </button>
          </div>
        )}
      </div>

      {loading && <LoadingState />}
      {error && <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">⚠️ Errore: {error}</div>}

      {!loading && !error && (
        <>
          {filteredRows.length === 0 ? (
            <EmptyState
              {...(isSameDay(selectedDate, new Date()) ? emptyStates.noAppointmentsToday :
                isSameDay(selectedDate, new Date(new Date().setDate(new Date().getDate() + 1))) ? emptyStates.noAppointmentsTomorrow :
                  emptyStates.noAppointments)}
              action={
                <button onClick={() => router.push('/op/appointments/new')} className="bg-gradient-to-br from-yellow-300 to-orange-400 text-slate-900 px-6 py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-all">
                  + Nuovo Appuntamento
                </button>
              }
            />
          ) : isAgendaView && filter !== 'all' ? (
            /* AGENDA VIEW - SLIM VERSION */
            <div
              ref={agendaContainerRef}
              className="relative border-l-2 border-slate-100 ml-8 h-[500px] overflow-y-auto bg-slate-50/30 rounded-2xl shadow-inner no-scrollbar sticky-hours"
            >
              <div className="relative min-h-[640px]">
                {timeSlots.map((hour) => (
                  <div key={hour} className="absolute w-full border-t border-slate-100/50 flex items-center" style={{ top: `${(hour - 8) * hourHeight}px`, height: '1px' }}>
                    <span className="absolute -left-10 text-[10px] font-bold text-slate-400">{hour}:00</span>
                  </div>
                ))}

                {filteredRows.map((r) => {
                  const pos = getPosition(r.res_starts_at);
                  const h = Math.max(getHeight(r.res_duration_minutes), 32);
                  const isPast = new Date(r.res_starts_at) < new Date();
                  const effectiveStatus = r.res_status === 'scheduled' && isPast ? 'completed' : r.res_status;

                  let statusColor = 'border-amber-400 bg-amber-50/50';
                  if (effectiveStatus === 'completed') statusColor = 'border-emerald-500 bg-emerald-50/30';
                  if (effectiveStatus === 'cancelled') statusColor = 'border-slate-300 bg-slate-100/50 opacity-50';

                  return (
                    <div
                      key={r.res_id}
                      onClick={() => router.push(`/op/appointments/${r.res_id}`)}
                      className={`absolute left-2 right-2 rounded-lg flex items-center px-3 border-l-[3px] transition-all active:scale-[0.98] cursor-pointer shadow-sm overflow-hidden group ${statusColor}`}
                      style={{ top: `${pos}px`, height: `${h}px` }}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <span className="text-[11px] font-bold text-slate-900 truncate block group-hover:text-amber-600 transition-colors">
                          {r.res_patient_name}
                        </span>
                        {h >= 40 && (
                          <span className="text-[9px] text-slate-500 truncate block">
                            {r.res_service_name}
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] font-black text-slate-400 tabular-nums">
                        {new Date(r.res_starts_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* LIST VIEW */
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2 ml-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Totale:</span>
                <span className="text-sm font-bold text-orange-500">{eur(totalLordoCents)}</span>
                <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{filteredRows.length} Sedute</span>
              </div>

              {filteredRows.map((r) => {
                const isPast = new Date(r.res_starts_at) < new Date();
                const effectiveStatus = r.res_status === 'scheduled' && isPast ? 'completed' : r.res_status;

                return (
                  <div
                    key={r.res_id}
                    onClick={() => router.push(`/op/appointments/${r.res_id}`)}
                    className={`bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center active:scale-[0.98] transition-all cursor-pointer ${effectiveStatus === 'cancelled' ? 'opacity-50 grayscale' : ''}`}
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-slate-900 truncate">{r.res_patient_name ?? 'Paziente'}</h4>
                        <Badge status={effectiveStatus} />
                      </div>
                      <p className="text-xs text-slate-500 truncate">{r.res_service_name ?? 'Servizio'}</p>
                      <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-400 font-bold">
                        <span>🕒</span> {formatDateIT(r.res_starts_at)}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-slate-900">{eur(r.res_gross_amount_cents ?? 0)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* FAB */}
      <button
        onClick={() => router.push('/op/appointments/new')}
        className="fixed bottom-24 right-6 w-14 h-14 bg-gradient-to-br from-yellow-300 to-orange-500 text-slate-900 rounded-2xl shadow-2xl flex items-center justify-center text-2xl font-bold active:scale-90 transition-all z-20"
        aria-label="Nuovo appuntamento"
      >
        +
      </button>
    </div>
  );
}
