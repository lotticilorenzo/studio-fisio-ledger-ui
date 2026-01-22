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

export default function AdminAppointmentsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [summary, setSummary] = useState<OperatorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());


  // Pagination & Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(20);

  async function load(month: string) {
    setLoading(true);
    setErr(null);
    setVisibleCount(20); // Reset pagination on reload

    const { start, end } = getMonthRange(month);

    const [appointmentsRes, summaryRes] = await Promise.all([
      supabase.rpc('admin_get_appointments', {
        p_start_date: start.toISOString(),
        p_end_date: end.toISOString()
      }),
      supabase.rpc('admin_month_summary', { p_year_month: month })
    ]);

    if (appointmentsRes.error) setErr(humanError(appointmentsRes.error.message));

    const mappedRows = (appointmentsRes.data ?? []).map((r: { id: string; starts_at: string; status: string; gross_amount_cents: number; commission_rate: number; commission_amount_cents: number; operator_name: string; service_name: string; patient_name: string }) => {
      const isPast = new Date(r.starts_at) < new Date();
      const effectiveStatus = r.status === 'scheduled' && isPast ? 'completed' : r.status;

      return {
        id: r.id,
        starts_at: r.starts_at,
        status: effectiveStatus,
        gross_amount_cents: r.gross_amount_cents,
        commission_rate: r.commission_rate,
        commission_amount_cents: r.commission_amount_cents,
        operators: r.operator_name ? { display_name: r.operator_name } : null,
        services: r.service_name ? { name: r.service_name } : null,
        patients: r.patient_name ? { full_name: r.patient_name } : null,
      }
    });
    setRows(mappedRows);

    if (!summaryRes.error && summaryRes.data) {
      setSummary(summaryRes.data as OperatorSummary[]);
    }

    setLoading(false);
  }

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
    link.download = `appuntamenti-${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    if (summary.length === 0) return;

    const doc = new jsPDF();
    const [year, month] = selectedMonth.split('-');
    const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
      'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    const monthName = monthNames[parseInt(month) - 1];

    doc.setFontSize(20);
    doc.text('STUDIO FISYO', 105, 20, { align: 'center' });
    doc.setFontSize(14);
    doc.text(`Report Commissioni - ${monthName} ${year}`, 105, 30, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Generato il: ${new Date().toLocaleDateString('it-IT')}`, 105, 38, { align: 'center' });

    const tableData = summary.map(s => [
      s.operator_name,
      s.num_appointments.toString(),
      `€${(s.total_gross_cents / 100).toFixed(2)}`,
      `€${(s.total_commission_cents / 100).toFixed(2)}`,
      `€${(s.total_net_cents / 100).toFixed(2)}`,
    ]);

    const totals = summary.reduce((acc, s) => ({
      appointments: acc.appointments + s.num_appointments,
      gross: acc.gross + s.total_gross_cents,
      commission: acc.commission + s.total_commission_cents,
      net: acc.net + s.total_net_cents,
    }), { appointments: 0, gross: 0, commission: 0, net: 0 });

    tableData.push([
      'TOTALE',
      totals.appointments.toString(),
      `€${(totals.gross / 100).toFixed(2)}`,
      `€${(totals.commission / 100).toFixed(2)}`,
      `€${(totals.net / 100).toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: 45,
      head: [['Operatore', 'Appuntamenti', 'Lordo', 'Comm. Studio', 'Netto Operatore']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    });

    doc.save(`report-commissioni-${selectedMonth}.pdf`);
  }

  useEffect(() => {
    load(selectedMonth);
  }, [selectedMonth]);

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const lower = searchTerm.toLowerCase();
    return rows.filter(r =>
      (r.operators?.display_name ?? '').toLowerCase().includes(lower) ||
      (r.services?.name ?? '').toLowerCase().includes(lower) ||
      (r.patients?.full_name ?? '').toLowerCase().includes(lower)
    );
  }, [rows, searchTerm]);

  const visibleRows = useMemo(() => {
    return filteredRows.slice(0, visibleCount);
  }, [filteredRows, visibleCount]);

  const totaleLordo = useMemo(() => rows.reduce((s, r) => s + (r.gross_amount_cents ?? 0), 0), [rows]);
  const totaleComm = useMemo(() => rows.reduce((s, r) => s + (r.commission_amount_cents ?? 0), 0), [rows]);
  const totaleNetto = totaleLordo - totaleComm;

  // Styles
  const pageStyle: React.CSSProperties = { padding: '16px' };
  const headerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' };
  // Titolo scuro per migliore leggibilità
  const titleStyle: React.CSSProperties = {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#0f172a',
    fontFamily: 'Poppins, sans-serif',
  };
  const btnPrimary: React.CSSProperties = { background: 'linear-gradient(135deg, #f4f119 0%, #ff9900 100%)', color: '#0f172a', border: 'none', borderRadius: '8px', padding: '8px 16px', fontWeight: 600, cursor: 'pointer' };
  const btnSecondary: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 16px', fontWeight: 500, cursor: 'pointer', color: '#475569' };
  const filterRow: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px', alignItems: 'center' };
  const inputStyle: React.CSSProperties = { padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '1rem', minHeight: '44px' };
  const sectionTitle: React.CSSProperties = { fontSize: '1rem', fontWeight: 600, marginBottom: '12px', marginTop: '24px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' };
  const tableContainer: React.CSSProperties = { overflowX: 'auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' };
  const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' };
  const thStyle: React.CSSProperties = { textAlign: 'left', padding: '12px', fontWeight: 600, color: '#475569', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' };
  const tdStyle: React.CSSProperties = { padding: '12px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' };
  const btnLoadMore: React.CSSProperties = { width: '100%', padding: '12px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '8px', marginTop: '16px', fontWeight: 600, cursor: 'pointer', textAlign: 'center' };


  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h1 style={titleStyle}>Dashboard</h1>
        <button onClick={() => router.push('/admin/appointments/new')} style={btnPrimary}>
          + Nuovo
        </button>
      </div>

      {/* Filters */}
      <div style={filterRow}>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          style={{ ...inputStyle, maxWidth: '180px' }}
        />
        <button onClick={exportCSV} style={btnSecondary}>📥 CSV</button>
        <button onClick={exportPDF} style={btnSecondary}>📄 PDF</button>
        <button onClick={() => load(selectedMonth)} style={{ ...btnSecondary, padding: '8px 12px' }}>↻</button>
      </div>


      {/* KPI Cards - Commissioni evidenziato (guadagno studio) */}
      <KpiGrid>
        <KpiCard value={filteredRows.length} label="Appuntamenti" icon="📅" />
        <KpiCard value={eur(totaleLordo)} label="Lordo" icon="💰" />
        <KpiCard value={eur(totaleComm)} label="Commissioni" highlight icon="💼" />
        <KpiCard value={eur(totaleNetto)} label="Netto Op." icon="👤" />
      </KpiGrid>

      {loading && <LoadingState />}

      {err && (
        <div style={{ background: '#fee2e2', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '16px', color: '#991b1b', marginBottom: '16px' }}>
          ⚠️ {err}
        </div>
      )}

      {/* Summary per Operatore */}
      {!loading && summary.length > 0 && (
        <div>
          <h2 style={sectionTitle}>📊 Riepilogo per operatore</h2>
          <div style={tableContainer}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Operatore</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>App.</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Lordo</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Comm.</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Netto</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={s.operator_id}>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{s.operator_name}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{s.num_appointments}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{eur(s.total_gross_cents)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#10b981' }}>{eur(s.total_commission_cents)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{eur(s.total_net_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Appointments Table */}
      {!loading && !err && (
        <div>

          <h2 style={sectionTitle}>📋 Elenco appuntamenti</h2>

          {/* Search Bar */}
          <div style={{ marginBottom: '16px' }}>
            <input
              type="text"
              placeholder="🔍 Cerca operatore, servizio, paziente..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setVisibleCount(20); // Reset scroll on search
              }}
              style={{ ...inputStyle, width: '100%' }}
            />
          </div>

          {/* Mobile List (Visible < md) */}
          <div className="md:hidden space-y-4">
            {filteredRows.length === 0 ? (
              <div className="text-center p-8 text-slate-400 bg-white rounded-xl border border-slate-200">
                {searchTerm ? 'Nessun risultato trovato.' : 'Nessun appuntamento nel mese selezionato.'}
              </div>
            ) : (
              visibleRows.map((r) => (
                <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-semibold text-slate-800">
                        {new Date(r.starts_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="text-sm text-slate-500 mt-1">{r.operators?.display_name ?? '-'}</div>
                    </div>
                    <Badge status={r.status} />
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                    <div className="text-sm font-medium text-slate-700">
                      {eur(r.gross_amount_cents ?? 0)}
                    </div>
                    <button
                      onClick={() => router.push(`/admin/appointments/${r.id}`)}
                      className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors flex items-center gap-2"
                    >
                      👁️ Dettagli
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table (Visible >= md) */}
          <div className="hidden md:block overflow-x-auto bg-white border border-slate-200 rounded-xl">
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Data/Ora</th>
                  <th style={thStyle}>Operatore</th>
                  <th style={thStyle}>Servizio</th>
                  <th style={thStyle}>Paziente</th>
                  <th style={thStyle}>Stato</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Lordo</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Comm.</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ ...tdStyle, textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                      {searchTerm ? 'Nessun risultato trovato.' : 'Nessun appuntamento nel mese selezionato.'}
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((r) => (
                    <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/admin/appointments/${r.id}`)} className="hover:bg-slate-50 transition-colors">
                      <td style={tdStyle}>{new Date(r.starts_at).toLocaleString('it-IT')}</td>
                      <td style={tdStyle}>{r.operators?.display_name ?? '-'}</td>
                      <td style={tdStyle}>{r.services?.name ?? '-'}</td>
                      <td style={tdStyle}>{r.patients?.full_name ?? '-'}</td>
                      <td style={tdStyle}><Badge status={r.status} /></td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{eur(r.gross_amount_cents ?? 0)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{eur(r.commission_amount_cents ?? 0)}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span style={{ fontSize: '1rem' }}>✏️</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Load More Button */}
          {visibleCount < filteredRows.length && (
            <button
              onClick={() => setVisibleCount(prev => prev + 20)}
              style={btnLoadMore}
            >
              🔽 Carica altri {filteredRows.length - visibleCount > 20 ? 20 : filteredRows.length - visibleCount} appuntamenti
              <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 400, marginTop: '4px' }}>
                (Visualizzati {visibleCount} di {filteredRows.length})
              </span>
            </button>
          )}

        </div>
      )}
    </div>
  );
}
