'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { humanError } from '@/lib/humanError';

type Service = { id: string; name: string };
type Row = {
  id: string;
  starts_at: string;
  status: string;
  service_id: string | null;
  service_name: string | null;
  patient_name: string | null;
  gross_amount_cents: number;
  notes: string | null;
};

export default function OpEditAppointmentPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [services, setServices] = useState<Service[]>([]);
  const [row, setRow] = useState<Row | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // form
  const [startsAt, setStartsAt] = useState<string>('');
  const [serviceId, setServiceId] = useState<string>('');
  const [patientName, setPatientName] = useState<string>(''); // MVP: solo nome (disabled)
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
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  }

  useEffect(() => {
    (async () => {
      setErr(null);

      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) {
        router.replace('/login');
        return;
      }

      // carica servizi dell'operatore corrente
      const { data: servicesData, error: servicesError } = await supabase.rpc('get_my_services_op');
      if (servicesError) {
        setErr(humanError(servicesError.message));
        setLoading(false);
        return;
      }
      setServices((servicesData ?? []) as Service[]);

      // carica lista appuntamenti OP e trova quello giusto
      const { data, error } = await supabase.rpc('get_my_appointments_op', { p_limit: 500 });
      if (error) {
        setErr(humanError(error.message));
        setLoading(false);
        return;
      }

      const found = (data ?? []).find((x: any) => x.id === id);
      if (!found) {
        setErr('Appuntamento non trovato o non autorizzato.');
        setLoading(false);
        return;
      }

      setRow(found as Row);

      setStartsAt(toDatetimeLocal(found.starts_at));
      setServiceId(found.service_id ?? '');
      setGrossEuro(((found.gross_amount_cents ?? 0) / 100).toFixed(2));
      setNotes(found.notes ?? '');
      setStatus(found.status ?? 'scheduled');
      setPatientName(found.patient_name ?? '');

      setLoading(false);
    })();
  }, [id, router]);

  async function save() {
    if (!id) return;

    setSaving(true);
    setErr(null);

    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) {
      router.replace('/login');
      return;
    }

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

    // Conferma prima di disdire
    const conferma = window.confirm(
      'Sei sicuro di voler disdire questo appuntamento?\n\nQuesta azione non può essere annullata.'
    );
    if (!conferma) return;

    setSaving(true);
    setErr(null);

    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) {
      router.replace('/login');
      return;
    }

    const { error } = await supabase.rpc('op_cancel_appointment', {
      p_appointment_id: id,
    });

    if (error) {
      setErr(humanError(error.message));
      setSaving(false);
      return;
    }

    router.replace('/op/appointments');
  }

  if (loading) return <main className="p-6">Carico…</main>;

  return (
    <main className="p-6 max-w-xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Modifica appuntamento</h1>
        <button className="border rounded px-3 py-2" onClick={() => router.back()}>
          Indietro
        </button>
      </div>

      {err && (
        <div className="mt-4 border border-red-500 rounded p-3 text-red-200">
          Errore: {err}
        </div>
      )}

      <div className="mt-6 space-y-4">
        <div>
          <label className="block text-sm mb-1">Data e ora</label>
          <input
            type="datetime-local"
            className="w-full border rounded px-3 py-2 bg-transparent"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Paziente</label>
          <input
            className="w-full border rounded px-3 py-2 bg-transparent"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            disabled
          />
          <p className="text-xs opacity-70 mt-1">(Per MVP non cambiamo il paziente qui.)</p>
        </div>

        <div>
          <label className="block text-sm mb-1">Servizio</label>
          <select
            className="w-full border rounded px-3 py-2 bg-transparent"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
          >
            <option value="">Nessun servizio</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">Stato</label>
          <select
            className="w-full border rounded px-3 py-2 bg-transparent"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="scheduled">Programmato</option>
            <option value="completed">Completato</option>
            <option value="no_show">Non presentato</option>
            <option value="cancelled">Disdetto</option>
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">Importo lordo (€)</label>
          <input
            className="w-full border rounded px-3 py-2 bg-transparent"
            value={grossEuro}
            onChange={(e) => setGrossEuro(e.target.value)}
            inputMode="decimal"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Note</label>
          <textarea
            className="w-full border rounded px-3 py-2 bg-transparent"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        <button onClick={save} disabled={saving} className="w-full border rounded px-3 py-2">
          {saving ? 'Salvo…' : 'Salva modifiche'}
        </button>

        <button onClick={cancel} disabled={saving} className="w-full border rounded px-3 py-2">
          Disdici appuntamento
        </button>
      </div>
    </main>
  );
}
