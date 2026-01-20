'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { humanError } from '@/lib/humanError';

type OperatorRow = { id: string; display_name: string; commission_rate: number };
type ServiceRow = { id: string; name: string };

export default function AdminEditAppointmentPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const id = params?.id;

    const [operators, setOperators] = useState<OperatorRow[]>([]);
    const [services, setServices] = useState<ServiceRow[]>([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // form
    const [operatorId, setOperatorId] = useState<string>('');
    const [serviceId, setServiceId] = useState<string>('');
    const [patientName, setPatientName] = useState<string>('');
    const [startsAt, setStartsAt] = useState<string>('');
    const [status, setStatus] = useState<'scheduled' | 'completed' | 'cancelled' | 'no_show'>('scheduled');
    const [grossEuro, setGrossEuro] = useState<string>('0');
    const [notes, setNotes] = useState<string>('');
    const [marketingConsent, setMarketingConsent] = useState(false);

    const grossCents = useMemo(() => {
        const n = Number(String(grossEuro).replace(',', '.'));
        return Number.isFinite(n) ? Math.round(n * 100) : 0;
    }, [grossEuro]);

    const selectedOperator = useMemo(
        () => operators.find((o) => o.id === operatorId) ?? null,
        [operators, operatorId]
    );

    const commissionPreview = useMemo(() => {
        const eur = Number(grossEuro.replace(',', '.'));
        const rate = selectedOperator?.commission_rate ?? 0;
        const comm = eur * rate;
        return {
            rate,
            comm: isFinite(comm) ? comm : 0,
            net: isFinite(eur - comm) ? eur - comm : 0,
        };
    }, [grossEuro, selectedOperator]);

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

            // Carica operatori e servizi
            const [opRes, srvRes] = await Promise.all([
                supabase.from('operators').select('id,display_name,commission_rate').order('display_name'),
                supabase.from('services').select('id,name').order('name'),
            ]);

            if (opRes.error) {
                setErr(humanError(opRes.error.message));
                setLoading(false);
                return;
            }
            if (srvRes.error) {
                setErr(humanError(srvRes.error.message));
                setLoading(false);
                return;
            }

            setOperators((opRes.data ?? []) as OperatorRow[]);
            setServices((srvRes.data ?? []) as ServiceRow[]);

            // Carica appuntamento
            const { data, error } = await supabase.rpc('admin_get_appointment_by_id', { p_id: id });
            if (error) {
                setErr(humanError(error.message));
                setLoading(false);
                return;
            }

            const found = Array.isArray(data) && data.length > 0 ? data[0] : null;
            if (!found) {
                setErr('Appuntamento non trovato.');
                setLoading(false);
                return;
            }

            setOperatorId(found.operator_id ?? '');
            setServiceId(found.service_id ?? '');
            setPatientName(found.patient_name ?? '');
            setStartsAt(toDatetimeLocal(found.starts_at));
            setStatus(found.status ?? 'scheduled');
            setGrossEuro(((found.gross_amount_cents ?? 0) / 100).toFixed(2));
            setNotes(found.notes ?? '');
            setMarketingConsent(found.marketing_consent ?? false);

            setLoading(false);
        })();
    }, [id]);

    async function save() {
        setSaving(true);
        setErr(null);

        if (!operatorId) {
            setErr('Seleziona un operatore.');
            setSaving(false);
            return;
        }
        if (!startsAt) {
            setErr('Seleziona data e ora.');
            setSaving(false);
            return;
        }

        const iso = startsAt.length === 16 ? `${startsAt}:00` : startsAt;
        const starts_at = new Date(iso).toISOString();

        const { error } = await supabase.rpc('admin_update_appointment', {
            p_id: id,
            p_operator_id: operatorId,
            p_service_id: serviceId || null,
            p_patient_name: patientName.trim() || null,
            p_starts_at: starts_at,
            p_status: status,
            p_gross_amount_cents: grossCents,
            p_notes: notes || null,
            p_marketing_consent: marketingConsent,
        });

        if (error) {
            setErr(humanError(error.message));
            setSaving(false);
            return;
        }

        router.push('/admin/appointments');
    }

    if (loading) {
        return (
            <main className="p-6">
                <div className="animate-pulse">Caricamento...</div>
            </main>
        );
    }

    return (
        <main className="p-6 max-w-xl">
            <div className="flex items-center justify-between gap-3 mb-4">
                <h1 className="text-2xl font-semibold">Modifica appuntamento</h1>
                <button
                    onClick={() => router.push('/admin/appointments')}
                    className="px-4 py-2 rounded-lg border border-white/20 hover:bg-white/10 transition"
                >
                    ← Indietro
                </button>
            </div>

            {err && (
                <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm">
                    {err}
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

                <div className="flex items-center gap-3">
                    <input
                        type="checkbox"
                        id="marketingConsentEdit"
                        checked={marketingConsent}
                        onChange={(e) => setMarketingConsent(e.target.checked)}
                        className="w-5 h-5 rounded border-white/20 bg-black/30"
                    />
                    <label htmlFor="marketingConsentEdit" className="text-sm">
                        Consenso comunicazioni marketing (email/SMS)
                    </label>
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
                            onChange={(e) => setStatus(e.target.value as 'scheduled' | 'completed' | 'cancelled' | 'no_show')}
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
                            value={grossEuro}
                            onChange={(e) => setGrossEuro(e.target.value)}
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
                    onClick={save}
                    disabled={saving}
                    className="w-full rounded-lg bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-medium p-3 disabled:opacity-50"
                >
                    {saving ? 'Salvataggio...' : 'Salva modifiche'}
                </button>
            </div>
        </main>
    );
}
