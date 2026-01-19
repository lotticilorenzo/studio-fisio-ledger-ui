"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";

type OperatorRow = { id: string; display_name: string; commission_rate: number };
type ServiceRow = { id: string; name: string; default_price_cents: number };

export default function NewAppointmentPage() {
  const [operators, setOperators] = useState<OperatorRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // form state
  const [operatorId, setOperatorId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [startsAt, setStartsAt] = useState(""); // datetime-local
  const [status, setStatus] = useState<"scheduled" | "completed" | "cancelled" | "no_show">("scheduled");
  const [patientName, setPatientName] = useState("");
  const [grossEur, setGrossEur] = useState("0.00");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    (async () => {
      setError(null);

      const { data: opData, error: opErr } = await supabase
        .from("operators")
        .select("id,display_name,commission_rate")
        .order("display_name", { ascending: true });

      const { data: srvData, error: srvErr } = await supabase
        .from("services")
        .select("id,name,default_price_cents")
        .order("name", { ascending: true });

      if (opErr) return setError(opErr.message);
      if (srvErr) return setError(srvErr.message);

      setOperators((opData ?? []) as OperatorRow[]);
      setServices((srvData ?? []) as ServiceRow[]);
    })();
  }, []);

  // autopopola prezzo quando scegli servizio
  useEffect(() => {
    const s = services.find((x) => x.id === serviceId);
    if (!s) return;
    setGrossEur((s.default_price_cents / 100).toFixed(2));
  }, [serviceId, services]);

  const selectedOperator = useMemo(
    () => operators.find((o) => o.id === operatorId) ?? null,
    [operators, operatorId]
  );

  const commissionPreview = useMemo(() => {
    const eur = Number(grossEur.replace(",", "."));
    const rate = selectedOperator?.commission_rate ?? 0;
    const comm = eur * rate;
    return {
      rate,
      comm: isFinite(comm) ? comm : 0,
      net: isFinite(eur - comm) ? eur - comm : 0,
    };
  }, [grossEur, selectedOperator]);

  const submit = async () => {
    setError(null);
    setOk(null);

    if (!operatorId) return setError("Seleziona un operatore.");
    if (!startsAt) return setError("Seleziona data e ora.");
    if (!grossEur) return setError("Inserisci importo.");

    const eur = Number(grossEur.replace(",", "."));
    if (!isFinite(eur) || eur <= 0) return setError("Importo non valido.");

    const gross_amount_cents = Math.round(eur * 100);

    // datetime-local -> ISO
    const iso = startsAt.length === 16 ? `${startsAt}:00` : startsAt;
    const starts_at = new Date(iso).toISOString();

    // Usa RPC server-side per calcolo commissioni
    const { error } = await supabase.rpc('admin_create_appointment', {
      p_operator_id: operatorId,
      p_service_id: serviceId || null,
      p_patient_name: patientName.trim() || null,
      p_starts_at: starts_at,
      p_status: status,
      p_gross_amount_cents: gross_amount_cents,
      p_notes: notes || null,
    });

    if (error) return setError(error.message);

    setOk("Appuntamento salvato ✅");
    setNotes("");
  };

  return (
    <main className="p-6 max-w-xl">
      <h1 className="text-2xl font-semibold">Nuovo appuntamento</h1>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm">
          {error}
        </div>
      )}
      {ok && (
        <div className="mt-4 rounded-lg border border-green-500/40 bg-green-500/10 p-3 text-sm">
          {ok}
        </div>
      )}

      <div className="mt-6 space-y-4">
        <div>
          <label className="text-sm opacity-80">Operatore</label>
          <select
            className="mt-1 w-full rounded-lg bg-black/30 border border-white/10 p-3"
            value={operatorId}
            onChange={(e) => setOperatorId(e.target.value)}
          >
            <option value="">Seleziona...</option>
            {operators.map((o) => (
              <option key={o.id} value={o.id}>
                {o.display_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm opacity-80">Servizio</label>
          <select
            className="mt-1 w-full rounded-lg bg-black/30 border border-white/10 p-3"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
          >
            <option value="">(opzionale)</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm opacity-80">Paziente</label>
          <input
            className="mt-1 w-full rounded-lg bg-black/30 border border-white/10 p-3"
            type="text"
            placeholder="Es. Mario Rossi"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm opacity-80">Data e ora</label>
          <input
            className="mt-1 w-full rounded-lg bg-black/30 border border-white/10 p-3"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm opacity-80">Stato</label>
            <select
              className="mt-1 w-full rounded-lg bg-black/30 border border-white/10 p-3"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            >
              <option value="scheduled">Programmato</option>
              <option value="completed">Completato</option>
              <option value="no_show">Non presentato</option>
              <option value="cancelled">Disdetto</option>
            </select>
          </div>

          <div>
            <label className="text-sm opacity-80">Importo (€)</label>
            <input
              className="mt-1 w-full rounded-lg bg-black/30 border border-white/10 p-3"
              value={grossEur}
              onChange={(e) => setGrossEur(e.target.value)}
              inputMode="decimal"
            />
          </div>
        </div>

        <div className="rounded-lg border border-white/10 p-3 text-sm">
          <div>Commissione: {(commissionPreview.rate * 100).toFixed(0)}%</div>
          <div>Commissione €: {commissionPreview.comm.toFixed(2)}</div>
          <div>Netto operatore €: {commissionPreview.net.toFixed(2)}</div>
        </div>

        <div>
          <label className="text-sm opacity-80">Note (opzionale)</label>
          <textarea
            className="mt-1 w-full rounded-lg bg-black/30 border border-white/10 p-3"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        <button
          onClick={submit}
          className="w-full rounded-lg bg-white text-black font-medium p-3"
        >
          Salva
        </button>
      </div>
    </main>
  );
}
