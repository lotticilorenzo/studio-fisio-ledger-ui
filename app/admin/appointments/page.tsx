'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { humanError } from '@/lib/humanError';
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

function statusLabel(s: string) {
  if (s === 'scheduled') return 'Programmato';
  if (s === 'completed') return 'Completato';
  if (s === 'cancelled') return 'Disdetto';
  if (s === 'no_show') return 'Non presentato';
  return s;
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

    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) {
      router.replace('/login');
      return;
    }

    const { start, end } = getMonthRange(month);

    // Carica appuntamenti
    const { data, error } = await supabase
      .from('appointments')
      .select(
        `
        id,
        starts_at,
        status,
        gross_amount_cents,
        commission_rate,
        commission_amount_cents,
        operators:operator_id ( display_name ),
        services:service_id ( name ),
        patients:patient_id ( full_name )
      `
      )
      .gte('starts_at', start.toISOString())
      .lte('starts_at', end.toISOString())
      .order('starts_at', { ascending: false });

    if (error) setErr(humanError(error.message));
    setRows((data as any) ?? []);

    // Carica riepilogo per operatore
    const { data: summaryData, error: summaryError } = await supabase.rpc('admin_month_summary', {
      p_year_month: month
    });

    if (!summaryError && summaryData) {
      setSummary(summaryData as OperatorSummary[]);
    }

    setLoading(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  function exportCSV() {
    if (rows.length === 0) return;

    const headers = ['Data/Ora', 'Operatore', 'Servizio', 'Paziente', 'Stato', 'Lordo', 'Commissione', 'Netto'];
    const csvRows = rows.map(r => {
      const netto = (r.gross_amount_cents ?? 0) - (r.commission_amount_cents ?? 0);
      return [
        new Date(r.starts_at).toLocaleString('it-IT'),
        r.operators?.display_name ?? '-',
        r.services?.name ?? '-',
        r.patients?.full_name ?? '-',
        statusLabel(r.status),
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

    // Header
    doc.setFontSize(20);
    doc.text('STUDIO FISYO', 105, 20, { align: 'center' });
    doc.setFontSize(14);
    doc.text(`Report Commissioni - ${monthName} ${year}`, 105, 30, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Generato il: ${new Date().toLocaleDateString('it-IT')}`, 105, 38, { align: 'center' });

    // Summary table
    const tableData = summary.map(s => [
      s.operator_name,
      s.num_appointments.toString(),
      `€${(s.total_gross_cents / 100).toFixed(2)}`,
      `€${(s.total_commission_cents / 100).toFixed(2)}`,
      `€${(s.total_net_cents / 100).toFixed(2)}`,
    ]);

    // Add totals row
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
      footStyles: { fillColor: [52, 73, 94], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { halign: 'right', cellWidth: 30 },
        2: { halign: 'right', cellWidth: 30 },
        3: { halign: 'right', cellWidth: 35 },
        4: { halign: 'right', cellWidth: 35 },
      },
      didParseCell: (data) => {
        // Style the last row (totals) differently
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [52, 73, 94];
          data.cell.styles.textColor = 255;
        }
      },
    });

    doc.save(`report-commissioni-${selectedMonth}.pdf`);
  }

  useEffect(() => {
    load(selectedMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  const totaleLordo = useMemo(() => rows.reduce((s, r) => s + (r.gross_amount_cents ?? 0), 0), [rows]);
  const totaleComm = useMemo(() => rows.reduce((s, r) => s + (r.commission_amount_cents ?? 0), 0), [rows]);
  const totaleNetto = totaleLordo - totaleComm;

  return (
    <main className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-xl md:text-2xl font-semibold">Appuntamenti Admin</h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => router.push('/admin/appointments/new')}
            className="px-3 py-2 rounded border bg-blue-600 text-white"
          >
            + Nuovo
          </button>
          <button onClick={logout} className="px-3 py-2 rounded border">
            Logout
          </button>
        </div>
      </div>

      {/* Filtro Mese */}
      <div className="mt-4 flex flex-wrap gap-3 items-center">
        <label className="text-sm">Mese:</label>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="border rounded px-3 py-2 bg-transparent"
        />
        <button onClick={exportCSV} className="px-3 py-2 rounded border bg-green-600 text-white">
          📥 CSV
        </button>
        <button onClick={exportPDF} className="px-3 py-2 rounded border bg-red-600 text-white">
          📄 PDF
        </button>
        <button onClick={() => load(selectedMonth)} className="px-3 py-2 rounded border">
          ↻ Ricarica
        </button>
      </div>

      {/* Riepilogo per Operatore */}
      {summary.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-3">📊 Riepilogo per Operatore</h2>
          <div className="overflow-auto rounded border">
            <table className="min-w-full text-sm">
              <thead className="border-b bg-white/10">
                <tr>
                  <th className="text-left p-3">Operatore</th>
                  <th className="text-right p-3">Appuntamenti</th>
                  <th className="text-right p-3">Lordo</th>
                  <th className="text-right p-3">Comm. Studio</th>
                  <th className="text-right p-3">Netto Op.</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={s.operator_id} className="border-b">
                    <td className="p-3 font-medium">{s.operator_name}</td>
                    <td className="p-3 text-right">{s.num_appointments}</td>
                    <td className="p-3 text-right">{eur(s.total_gross_cents)}</td>
                    <td className="p-3 text-right text-green-400">{eur(s.total_commission_cents)}</td>
                    <td className="p-3 text-right">{eur(s.total_net_cents)}</td>
                  </tr>
                ))}
                {/* Riga totali */}
                <tr className="bg-white/5 font-semibold">
                  <td className="p-3">TOTALE</td>
                  <td className="p-3 text-right">{summary.reduce((a, s) => a + s.num_appointments, 0)}</td>
                  <td className="p-3 text-right">{eur(summary.reduce((a, s) => a + s.total_gross_cents, 0))}</td>
                  <td className="p-3 text-right text-green-400">{eur(summary.reduce((a, s) => a + s.total_commission_cents, 0))}</td>
                  <td className="p-3 text-right">{eur(summary.reduce((a, s) => a + s.total_net_cents, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Totali */}
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <div className="rounded border px-3 py-2">
          Lordo: <b>{eur(totaleLordo)}</b>
        </div>
        <div className="rounded border px-3 py-2">
          Commissioni: <b>{eur(totaleComm)}</b>
        </div>
        <div className="rounded border px-3 py-2">
          Netto: <b>{eur(totaleNetto)}</b>
        </div>
        <div className="rounded border px-3 py-2 opacity-70">
          {rows.length} appuntamenti
        </div>
      </div>

      {loading && <p className="mt-6 text-center py-8">Caricamento…</p>}

      {err && (
        <div className="mt-6 rounded border border-red-500 p-3 text-red-200">
          Errore: {err}
        </div>
      )}

      {!loading && !err && (
        <div className="mt-6 overflow-auto rounded border">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-white/5">
              <tr>
                <th className="text-left p-3">Data/Ora</th>
                <th className="text-left p-3">Operatore</th>
                <th className="text-left p-3">Servizio</th>
                <th className="text-left p-3">Paziente</th>
                <th className="text-left p-3">Stato</th>
                <th className="text-right p-3">Lordo</th>
                <th className="text-right p-3">Comm.</th>
                <th className="text-right p-3">Netto</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const netto =
                  (r.gross_amount_cents ?? 0) - (r.commission_amount_cents ?? 0);
                return (
                  <tr key={r.id} className="border-b hover:bg-white/5">
                    <td className="p-3">{new Date(r.starts_at).toLocaleString('it-IT')}</td>
                    <td className="p-3">{r.operators?.display_name ?? '-'}</td>
                    <td className="p-3">{r.services?.name ?? '-'}</td>
                    <td className="p-3">{r.patients?.full_name ?? '-'}</td>
                    <td className="p-3">{statusLabel(r.status)}</td>
                    <td className="p-3 text-right">{eur(r.gross_amount_cents ?? 0)}</td>
                    <td className="p-3 text-right">
                      {eur(r.commission_amount_cents ?? 0)}
                    </td>
                    <td className="p-3 text-right">{eur(netto)}</td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td className="p-3 text-center py-8" colSpan={8}>
                    Nessun appuntamento nel mese selezionato.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
