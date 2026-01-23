'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { humanError } from '@/lib/humanError';
import { Badge } from '@/components/ui/Badge';
import { KpiCard, KpiGrid } from '@/components/ui/KpiCard';
import { LoadingState } from '@/components/ui/Loading';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { eur } from '@/lib/format';

type AppointmentRow = {
  id: string;
  starts_at: string;
  status: string;
  gross_amount_cents: number;
  commission_amount_cents: number;
  commission_rate: number;
  duration: number;
  operator_id: string;
  operators?: { display_name: string } | null;
  services?: { name: string } | null;
  patients?: { full_name: string } | null;
};

type OperatorSummary = {
  operator_id: string;
  operator_name: string;
  num_appointments: number;
  total_gross_cents: number;
  total_commission_cents: number;
  total_net_cents: number;
};

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthRange(monthStr: string) {
  const [year, month] = monthStr.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

function isSameDay(date1: Date, date2: Date) {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

export default function AdminAppointmentsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [summary, setSummary] = useState<OperatorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [filterMode, setFilterMode] = useState<'month' | 'day'>('month');
  const [isAgendaView, setIsAgendaView] = useState(false);

  // Pagination & Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(20);

  // Generate 14 days for the strip
  const dateStrip = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  async function load(monthFilter: string, dateFilter: Date) {
    setLoading(true);
    setErr(null);
    setVisibleCount(20);

    let start, end;
    if (filterMode === 'month') {
      ({ start, end } = getMonthRange(monthFilter));
    } else {
      start = new Date(dateFilter);
      start.setHours(0, 0, 0, 0);
      end = new Date(dateFilter);
      end.setHours(23, 59, 59, 999);
    }

    const [appointmentsRes, summaryRes] = await Promise.all([
      supabase.rpc('admin_get_appointments', {
        p_start_date: start.toISOString(),
        p_end_date: end.toISOString()
      }),
      filterMode === 'month'
        ? supabase.rpc('admin_month_summary', { p_year_month: monthFilter })
        : Promise.resolve({ data: [], error: null })
    ]);

    if (appointmentsRes.error) setErr(humanError(appointmentsRes.error.message));

    const mappedRows = (appointmentsRes.data ?? []).map((r: any) => {
      const isPast = new Date(r.starts_at) < new Date();
      const effectiveStatus = r.status === 'scheduled' && isPast ? 'completed' : r.status;

      return {
        id: r.id,
        starts_at: r.starts_at,
        status: effectiveStatus,
        gross_amount_cents: r.gross_amount_cents,
        commission_rate: r.commission_rate,
        commission_amount_cents: r.commission_amount_cents,
        duration: r.duration_minutes ?? 60,
        operator_id: r.operator_id,
        operators: r.operator_name ? { display_name: r.operator_name } : null,
        services: r.service_name ? { name: r.service_name } : null,
        patients: r.patient_name ? { full_name: r.patient_name } : null,
      };
    });
    setRows(mappedRows);

    if (!summaryRes.error && summaryRes.data) {
      setSummary(summaryRes.data as OperatorSummary[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    load(selectedMonth, selectedDate);
  }, [selectedMonth, selectedDate, filterMode]);

  const activeOperators = useMemo(() => {
    const map = new Map();
    rows.forEach(r => {
      if (r.operator_id && !map.has(r.operator_id)) {
        map.set(r.operator_id, r.operators?.display_name || 'Operatore');
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  function exportCSV() {
    if (rows.length === 0) return;
    const headers = ['Data/Ora', 'Operatore', 'Servizio', 'Stato', 'Lordo', 'Commissione', 'Netto'];
    const csvRows = rows.map(r => {
      const netto = (r.gross_amount_cents ?? 0) - (r.commission_amount_cents ?? 0);
      return [
        new Date(r.starts_at).toLocaleString('it-IT'),
        r.operators?.display_name ?? '-',
        r.services?.name ?? '-',
        r.status,
        (r.gross_amount_cents / 100).toFixed(2),
        (r.commission_amount_cents / 100).toFixed(2),
        (netto / 100).toFixed(2),
      ].join(';');
    });
    const csv = [headers.join(';'), ...csvRows].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report-${filterMode === 'month' ? selectedMonth : selectedDate.toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const lower = searchTerm.toLowerCase();
    return rows.filter(r =>
      (r.operators?.display_name ?? '').toLowerCase().includes(lower) ||
      (r.services?.name ?? '').toLowerCase().includes(lower) ||
      (r.patients?.full_name ?? '').toLowerCase().includes(lower)
    );
  }, [rows, searchTerm]);

  const visibleRows = useMemo(() => filteredRows.slice(0, visibleCount), [filteredRows, visibleCount]);
  const totaleLordo = useMemo(() => filteredRows.reduce((sum, r) => sum + (r.gross_amount_cents ?? 0), 0), [filteredRows]);
  const totaleComm = useMemo(() => filteredRows.reduce((sum, r) => sum + (r.commission_amount_cents ?? 0), 0), [filteredRows]);
  const totaleNetto = totaleLordo - totaleComm;

  const hourHeight = 44;
  const timeSlots = Array.from({ length: 13 }, (_, i) => 8 + i);

  return (
    <div className="p-4 md:p-6 pb-24 space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900 font-[Poppins]">Dashboard Admin</h1>
        <div className="flex gap-2">
          <button onClick={() => load(selectedMonth, selectedDate)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">↻</button>
          <button onClick={() => router.push('/admin/appointments/new')} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md active:scale-95 transition-all">
            + Nuovo
          </button>
        </div>
      </header>

      {/* Date Navigation Strip */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar scroll-smooth">
          <button
            onClick={() => { setFilterMode('month'); setIsAgendaView(false); }}
            className={`flex-shrink-0 px-5 py-3 rounded-2xl text-sm font-bold transition-all border ${filterMode === 'month' ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
          >
            📅 Mensile
          </button>
          <div className="w-px h-8 bg-slate-200 flex-shrink-0" />
          {dateStrip.map((d) => {
            const isActive = filterMode === 'day' && isSameDay(d, selectedDate);
            const isToday = isSameDay(d, new Date());
            return (
              <button
                key={d.toISOString()}
                onClick={() => { setFilterMode('day'); setSelectedDate(d); }}
                className={`flex-shrink-0 flex flex-col items-center justify-center min-w-[64px] h-[72px] rounded-2xl border transition-all ${isActive ? 'bg-gradient-to-br from-yellow-300 to-orange-400 border-orange-400 text-slate-900 shadow-lg scale-105 z-10' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'}`}
              >
                <span className={`text-[10px] uppercase font-bold ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>{d.toLocaleDateString('it-IT', { weekday: 'short' })}</span>
                <span className="text-xl font-black">{d.getDate()}</span>
                {isToday && !isActive && <div className="w-1 h-1 bg-orange-400 rounded-full mt-0.5" />}
              </button>
            );
          })}
        </div>

        <div className="flex justify-between items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl flex-1 max-w-[240px]">
            <button onClick={() => setIsAgendaView(false)} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${!isAgendaView ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>☰ Lista</button>
            <button onClick={() => setIsAgendaView(true)} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${isAgendaView ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>🕘 Agenda</button>
          </div>
          <div className="flex gap-2">
            {filterMode === 'month' && (
              <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-white outline-none focus:ring-2 ring-amber-400 transition-all" />
            )}
            <button onClick={exportCSV} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 shadow-sm">📥</button>
          </div>
        </div>
      </div>

      <KpiGrid>
        <KpiCard value={filteredRows.length} label="Appuntamenti" icon="📅" />
        <KpiCard value={eur(totaleLordo)} label="Lordo" icon="💰" />
        <KpiCard value={eur(totaleComm)} label="Commissioni" highlight icon="💼" />
        <KpiCard value={eur(totaleNetto)} label="Netto Op." icon="👤" />
      </KpiGrid>

      {loading ? <LoadingState /> : (
        <div className="space-y-6">
          {!isAgendaView ? (
            /* LIST VIEW (Table + Monthly Summary) */
            <div className="space-y-8">
              {filterMode === 'month' && summary.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="p-4 bg-slate-50 border-bottom border-slate-200">
                    <h3 className="text-sm font-bold text-slate-900 uppercase">Riepilogo Mensile Operatori</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50/50">
                          <th className="px-4 py-3 text-left font-bold text-slate-400 uppercase text-[10px]">Operatore</th>
                          <th className="px-4 py-3 text-right font-bold text-slate-400 uppercase text-[10px]">App.</th>
                          <th className="px-4 py-3 text-right font-bold text-slate-400 uppercase text-[10px]">Lordo</th>
                          <th className="px-4 py-3 text-right font-bold text-slate-400 uppercase text-[10px]">Studio</th>
                          <th className="px-4 py-3 text-right font-bold text-slate-400 uppercase text-[10px]">Netto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {summary.map(s => (
                          <tr key={s.operator_id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 font-bold text-slate-900">{s.operator_name}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{s.num_appointments}</td>
                            <td className="px-4 py-3 text-right text-slate-900 font-medium">{eur(s.total_gross_cents)}</td>
                            <td className="px-4 py-3 text-right text-emerald-600 font-bold">{eur(s.total_commission_cents)}</td>
                            <td className="px-4 py-3 text-right text-slate-900 font-bold">{eur(s.total_net_cents)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-200">
                  <input
                    type="text"
                    placeholder="🔍 Filtra per operatore, paziente o servizio..."
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:ring-2 ring-amber-400 outline-none transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="px-2 md:px-4 py-3 text-left font-bold text-slate-400 uppercase text-[10px]">Data</th>
                        <th className="hidden md:table-cell px-4 py-3 text-left font-bold text-slate-400 uppercase text-[10px]">Operatore</th>
                        <th className="px-2 md:px-4 py-3 text-left font-bold text-slate-400 uppercase text-[10px]">Paziente</th>
                        <th className="hidden sm:table-cell px-4 py-3 text-left font-bold text-slate-400 uppercase text-[10px]">Stato</th>
                        <th className="px-2 md:px-4 py-3 text-right font-bold text-slate-400 uppercase text-[10px]">Lordo</th>
                        <th className="hidden md:table-cell px-4 py-3 text-right font-bold text-slate-400 uppercase text-[10px]">Comm.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleRows.map(r => (
                        <tr key={r.id} onClick={() => router.push(`/admin/appointments/${r.id}`)} className="hover:bg-slate-50 transition-colors cursor-pointer capitalize">
                          {/* Data */}
                          <td className="px-2 md:px-4 py-3 text-slate-900 whitespace-nowrap">
                            <span className="font-bold block">{new Date(r.starts_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}</span>
                            <span className="block text-[10px] text-slate-400">{new Date(r.starts_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
                          </td>

                          {/* Operatore (Desktop only) */}
                          <td className="hidden md:table-cell px-4 py-3 text-slate-600 font-medium">{r.operators?.display_name || '-'}</td>

                          {/* Paziente + Service + Operator (Mobile) */}
                          <td className="px-2 md:px-4 py-3">
                            <span className="text-slate-900 font-bold block truncate max-w-[140px] md:max-w-none">{r.patients?.full_name || '-'}</span>
                            <span className="text-[10px] text-slate-400 block truncate max-w-[140px] md:max-w-none">{r.services?.name || '-'}</span>
                            {/* Mobile Operator Name */}
                            <span className="md:hidden text-[9px] text-indigo-500 font-bold uppercase mt-1 block truncate max-w-[140px]">
                              {r.operators?.display_name}
                            </span>
                          </td>

                          {/* Stato (Desktop only) */}
                          <td className="hidden sm:table-cell px-4 py-3"><Badge status={r.status} /></td>

                          {/* Lordo + Mobile Status */}
                          <td className="px-2 md:px-4 py-3 text-right sticky right-0 bg-white/50 group-hover:bg-slate-50">
                            <div className="font-bold text-slate-900">{eur(r.gross_amount_cents)}</div>
                            <div className="sm:hidden mt-1 flex justify-end">
                              <Badge status={r.status} className="scale-75 origin-right text-[10px]" />
                            </div>
                          </td>

                          {/* Commissione (Desktop only) */}
                          <td className="hidden md:table-cell px-4 py-3 text-right font-medium text-emerald-600">{eur(r.commission_amount_cents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* AGENDA VIEW (Multi-Operator Columns) */
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xl flex flex-col h-[600px]">
              <div className="flex border-b border-slate-100 bg-slate-50/50">
                <div className="w-14 flex-shrink-0" /> {/* Hour labels spacer */}
                {activeOperators.map(op => (
                  <div key={op.id} className="flex-1 py-4 text-center border-l border-slate-100">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest truncate px-2">{op.name}</h4>
                  </div>
                ))}
                {activeOperators.length === 0 && <div className="flex-1 py-10 text-center text-slate-400 italic">Nessun appuntamento per questo giorno.</div>}
              </div>

              <div className="flex-1 overflow-y-auto relative no-scrollbar">
                <div className="relative" style={{ height: `${timeSlots.length * hourHeight}px` }}>
                  {/* Hour background lines */}
                  {timeSlots.map(hour => (
                    <div key={hour} className="absolute w-full border-t border-slate-100 flex items-center" style={{ top: `${(hour - 8) * hourHeight}px`, height: '1px' }}>
                      <span className="absolute left-2 text-[10px] font-bold text-slate-400">{hour}:00</span>
                    </div>
                  ))}

                  {/* Multi-column Grid */}
                  <div className="flex h-full ml-14">
                    {activeOperators.map(op => (
                      <div key={op.id} className="flex-1 relative border-l border-slate-100/50">
                        {filteredRows.filter(r => r.operator_id === op.id).map(r => {
                          const date = new Date(r.starts_at);
                          const pos = (date.getHours() - 8) * hourHeight + (date.getMinutes() / 60) * hourHeight;
                          const height = (r.duration / 60) * hourHeight;

                          let statusColor = 'bg-amber-50 border-amber-400 text-amber-900';
                          if (r.status === 'completed') statusColor = 'bg-emerald-50 border-emerald-500 text-emerald-900';
                          if (r.status === 'cancelled') statusColor = 'bg-slate-50 border-slate-200 text-slate-400 opacity-60';

                          return (
                            <div
                              key={r.id}
                              onClick={() => router.push(`/admin/appointments/${r.id}`)}
                              className={`absolute inset-x-1 rounded-lg border-l-4 p-2 shadow-sm transition-all hover:scale-[1.02] cursor-pointer overflow-hidden group ${statusColor}`}
                              style={{ top: `${pos}px`, height: `${height - 2}px` }}
                            >
                              <div className="text-[10px] font-black truncate">{r.patients?.full_name}</div>
                              {height > 30 && <div className="text-[8px] opacity-70 truncate uppercase font-bold">{r.services?.name}</div>}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
