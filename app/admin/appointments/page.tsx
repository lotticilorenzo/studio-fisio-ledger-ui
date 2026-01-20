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

function eur(cents: number) {
  return `€${((cents ?? 0) / 100).toFixed(2)}`;
}

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

  async function load(month: string) {
    setLoading(true);
    setErr(null);

    const { start, end } = getMonthRange(month);

    const [appointmentsRes, summaryRes] = await Promise.all([
      supabase.rpc('admin_get_appointments', {
        p_start_date: start.toISOString(),
        p_end_date: end.toISOString()
      }),
      supabase.rpc('admin_month_summary', { p_year_month: month })
    ]);

    if (appointmentsRes.error) setErr(humanError(appointmentsRes.error.message));

    const mappedRows = (appointmentsRes.data ?? []).map((r: { id: string; starts_at: string; status: string; gross_amount_cents: number; commission_rate: number; commission_amount_cents: number; operator_name: string; service_name: string; patient_name: string }) => ({
      id: r.id,
      starts_at: r.starts_at,
      status: r.status,
      gross_amount_cents: r.gross_amount_cents,
      commission_rate: r.commission_rate,
      commission_amount_cents: r.commission_amount_cents,
      operators: r.operator_name ? { display_name: r.operator_name } : null,
      services: r.service_name ? { name: r.service_name } : null,
      patients: r.patient_name ? { full_name: r.patient_name } : null,
    }));
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

  const totaleLordo = useMemo(() => rows.reduce((s, r) => s + (r.gross_amount_cents ?? 0), 0), [rows]);
  const totaleComm = useMemo(() => rows.reduce((s, r) => s + (r.commission_amount_cents ?? 0), 0), [rows]);
  const totaleNetto = totaleLordo - totaleComm;

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <button
          onClick={() => router.push('/admin/appointments/new')}
          className="btn btn-primary btn-sm"
        >
          + Nuovo
        </button>
      </div>

      {/* Month Filter */}
      <div className="flex flex-wrap gap-2 mb-4" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="form-input"
          style={{ maxWidth: '180px' }}
        />
        <button onClick={exportCSV} className="btn btn-secondary btn-sm">
          📥 CSV
        </button>
        <button onClick={exportPDF} className="btn btn-secondary btn-sm">
          📄 PDF
        </button>
        <button onClick={() => load(selectedMonth)} className="btn btn-ghost btn-sm">
          ↻
        </button>
      </div>

      {/* KPI Cards */}
      <KpiGrid>
        <KpiCard value={rows.length} label="Appuntamenti" icon="📅" />
        <KpiCard value={eur(totaleLordo)} label="Lordo" accent />
        <KpiCard value={eur(totaleComm)} label="Commissioni" icon="💼" />
        <KpiCard value={eur(totaleNetto)} label="Netto Op." icon="👤" />
      </KpiGrid>

      {loading && <div className="mt-6"><LoadingState /></div>}

      {err && (
        <div className="error-box mt-4">
          ⚠️ Errore: {err}
        </div>
      )}

      {/* Summary per Operatore */}
      {!loading && summary.length > 0 && (
        <div className="mt-6">
          <h2 className="section-title">📊 Riepilogo per operatore</h2>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Operatore</th>
                  <th style={{ textAlign: 'right' }}>App.</th>
                  <th style={{ textAlign: 'right' }}>Lordo</th>
                  <th style={{ textAlign: 'right' }}>Comm.</th>
                  <th style={{ textAlign: 'right' }}>Netto</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={s.operator_id}>
                    <td className="font-medium">{s.operator_name}</td>
                    <td style={{ textAlign: 'right' }}>{s.num_appointments}</td>
                    <td style={{ textAlign: 'right' }}>{eur(s.total_gross_cents)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--success)' }}>{eur(s.total_commission_cents)}</td>
                    <td style={{ textAlign: 'right' }}>{eur(s.total_net_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Appointments Table */}
      {!loading && !err && (
        <div className="mt-6">
          <h2 className="section-title">📋 Elenco appuntamenti</h2>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Data/Ora</th>
                  <th>Operatore</th>
                  <th>Servizio</th>
                  <th>Paziente</th>
                  <th>Stato</th>
                  <th style={{ textAlign: 'right' }}>Lordo</th>
                  <th style={{ textAlign: 'right' }}>Comm.</th>
                  <th style={{ textAlign: 'center' }}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                      Nessun appuntamento nel mese selezionato.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id}>
                      <td>{new Date(r.starts_at).toLocaleString('it-IT')}</td>
                      <td>{r.operators?.display_name ?? '-'}</td>
                      <td>{r.services?.name ?? '-'}</td>
                      <td>{r.patients?.full_name ?? '-'}</td>
                      <td><Badge status={r.status} /></td>
                      <td style={{ textAlign: 'right' }}>{eur(r.gross_amount_cents ?? 0)}</td>
                      <td style={{ textAlign: 'right' }}>{eur(r.commission_amount_cents ?? 0)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => router.push(`/admin/appointments/${r.id}`)}
                          className="btn btn-ghost btn-sm"
                        >
                          ✏️
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
