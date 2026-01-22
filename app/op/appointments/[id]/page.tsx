'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { humanError } from '@/lib/humanError';
import { LoadingState, Spinner } from '@/components/ui/Loading';
import { eur } from '@/lib/format';

type Service = { id: string; name: string };
type HistoryItem = {
  h_appointment_id: string;
  h_starts_at: string;
  h_service_name: string;
  h_notes: string;
  h_status: string;
};

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
  const [patientId, setPatientId] = useState<string | null>(null);
  const [grossEuro, setGrossEuro] = useState<string>('0');
  const [notes, setNotes] = useState<string>('');
  const [status, setStatus] = useState<string>('scheduled');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

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
    if (!id) return;
    (async () => {
      setLoading(true);
      setErr(null);

      const [servicesRes, appointmentRes] = await Promise.all([
        supabase.rpc('get_my_services_op'),
        supabase.rpc('get_appointment_by_id_op', { p_id: id })
      ]);

      if (servicesRes.error) {
        setErr(humanError(servicesRes.error.message));
        setLoading(false);
        return;
      }
      setServices((servicesRes.data ?? []) as Service[]);

      if (appointmentRes.error) {
        setErr(humanError(appointmentRes.error.message));
        setLoading(false);
        return;
      }

      const found = appointmentRes.data?.[0];
      if (!found) {
        setErr('Appuntamento non trovato o non autorizzato.');
        setLoading(false);
        return;
      }

      setStartsAt(toDatetimeLocal(found.appt_starts_at));
      setServiceId(found.appt_service_id ?? '');
      setGrossEuro(((found.appt_gross_amount_cents ?? 0) / 100).toFixed(2));
      setNotes(found.appt_notes ?? '');
      setStatus(found.appt_status ?? 'scheduled');
      setPatientName(found.appt_patient_name ?? '');
      setPatientId(found.appt_patient_id ?? null);
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    if (patientId) {
      (async () => {
        const { data } = await supabase.rpc('op_get_patient_clinical_history', { p_patient_id: patientId });
        setHistory((data ?? []) as HistoryItem[]);
      })();
    }
  }, [patientId]);

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

  if (loading) return <div className="p-4 md:p-6"><LoadingState /></div>;

  return (
    <div className="p-4 md:p-6 space-y-6 pb-24 max-w-md mx-auto">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 font-[Poppins]">Dettaglio Appuntamento</h1>
          <p className="text-sm text-slate-500">{patientName}</p>
        </div>
        <button onClick={() => router.back()} className="text-slate-400 hover:text-slate-900 text-sm font-medium transition-colors">
          ← Indietro
        </button>
      </header>

      {err && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 text-sm mb-4">
          ⚠️ {err}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">📅 Data e ora</label>
          <input
            type="datetime-local"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition-all font-medium text-slate-700"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">🏷️ Servizio</label>
          <select
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition-all font-medium text-slate-700 appearance-none"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
          >
            <option value="">Nessun servizio selezionato</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">📊 Stato</label>
            <select
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition-all font-medium text-slate-700"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="scheduled">In programma</option>
              <option value="completed">Completato</option>
              <option value="no_show">Assente</option>
              <option value="cancelled">Disdetto</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">💰 Importo (€)</label>
            <input
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition-all font-medium text-slate-700"
              value={grossEuro}
              onChange={(e) => setGrossEuro(e.target.value)}
              inputMode="decimal"
            />
          </div>
        </div>

        <div className="pt-2">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1 flex items-center gap-2">
            📝 Diario Clinico
          </label>
          <textarea
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition-all text-slate-700 placeholder:text-slate-300 min-h-[140px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Cosa avete fatto oggi? Scrivi quil le note cliniche..."
          />
        </div>

        <div className="pt-4 space-y-3">
          <button
            onClick={save}
            disabled={saving}
            className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <Spinner size="sm" /> : '✓ Salva Progressi'}
          </button>

          <button
            onClick={cancel}
            disabled={saving}
            className="w-full text-red-500 font-semibold py-3 hover:bg-red-50 rounded-xl transition-all text-sm"
          >
            ✕ Disdici questo appuntamento
          </button>
        </div>
      </div>

      {/* Clinical History Section */}
      <div className="bg-slate-100 rounded-2xl p-1">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between p-4 text-slate-600 font-bold text-sm"
        >
          <span className="flex items-center gap-2">📖 Storico Clinico ({history.length})</span>
          <span>{showHistory ? '▲' : '▼'}</span>
        </button>

        {showHistory && (
          <div className="p-3 space-y-3">
            {history.filter(h => h.h_appointment_id !== id).length > 0 ? (
              history.filter(h => h.h_appointment_id !== id).map((h) => (
                <div key={h.h_appointment_id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      {new Date(h.h_starts_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-[10px] bg-slate-100 px-2 py-0.5 rounded uppercase font-bold text-slate-500">{h.h_service_name}</p>
                  </div>
                  <p className="text-xs text-slate-600 italic whitespace-pre-wrap leading-relaxed">
                    {h.h_notes || 'Nessuna nota registrata.'}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-center py-4 text-xs text-slate-400 italic">Nessuno storico disponibile.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
