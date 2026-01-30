'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { humanError } from '@/lib/humanError';
import { LoadingState } from '@/components/ui/Loading';

interface Patient {
    p_id: string;
    p_display_name: string;
    p_last_visit: string;
    p_total_appointments: number;
}

interface HistoryItem {
    h_appointment_id: string;
    h_starts_at: string;
    h_service_name: string;
    h_notes: string;
    h_status: string;
}

export default function OperatorPatientsPage() {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    useEffect(() => {
        async function loadPatients() {
            setLoading(true);
            const { data, error } = await supabase.rpc('op_get_my_patients');
            if (error) {
                setError(humanError(error.message));
            } else {
                setPatients((data ?? []) as Patient[]);
            }
            setLoading(false);
        }
        loadPatients();
    }, []);

    useEffect(() => {
        if (!selectedPatientId) {
            setHistory([]);
            return;
        }
        async function loadHistory() {
            setLoadingHistory(true);
            const { data } = await supabase.rpc('op_get_patient_clinical_history', { p_patient_id: selectedPatientId });
            setHistory((data ?? []) as HistoryItem[]);
            setLoadingHistory(false);
        }
        loadHistory();
    }, [selectedPatientId]);

    if (loading) return <div className="p-6"><LoadingState /></div>;

    const selectedPatient = patients.find(p => p.p_id === selectedPatientId);

    return (
        <div className="p-4 md:p-6 space-y-6 max-w-md mx-auto">
            {!selectedPatientId ? (
                <>
                    <header>
                        <h1 className="text-2xl font-bold text-slate-900 font-[Poppins]">I miei Pazienti</h1>
                        <p className="text-sm text-slate-500">Persone che hai trattato nel tempo</p>
                    </header>

                    {error && <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">⚠️ {error}</div>}

                    <div className="space-y-3">
                        {patients.map((p) => (
                            <button
                                key={p.p_id}
                                onClick={() => setSelectedPatientId(p.p_id)}
                                className="w-full text-left bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:border-amber-400 transition-all group"
                            >
                                <div className="flex justify-between items-center">
                                    <h3 className="font-bold text-slate-800 group-hover:text-amber-500 transition-colors">{p.p_display_name}</h3>
                                    <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">{p.p_total_appointments} appt.</span>
                                </div>
                                <p className="text-xs text-slate-400 mt-1 italic">Ultimo incontro: {new Date(p.p_last_visit).toLocaleDateString()}</p>
                            </button>
                        ))}
                        {patients.length === 0 && (
                            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                <p className="text-slate-400 text-xs italic">Nessun paziente trovato.</p>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <>
                    <header className="flex items-center gap-4">
                        <button onClick={() => setSelectedPatientId(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors text-slate-600">
                            ←
                        </button>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 font-[Poppins]">{selectedPatient?.p_display_name}</h2>
                            <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Storico Clinico</p>
                        </div>
                    </header>

                    <div className="space-y-4">
                        {loadingHistory ? (
                            <LoadingState />
                        ) : (
                            history.map((h) => (
                                <div key={h.h_appointment_id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <p className="text-xs font-bold text-slate-800">
                                                {new Date(h.h_starts_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}
                                            </p>
                                            <p className="text-[10px] text-slate-400 uppercase font-bold">{h.h_service_name}</p>
                                        </div>
                                        {(() => {
                                            const now = new Date();
                                            const startRes = new Date(h.h_starts_at);
                                            const isPast = startRes < now;
                                            const effectiveStatus = h.h_status === 'scheduled' && isPast ? 'completed' : h.h_status;
                                            return (
                                                <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${effectiveStatus === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                                    {effectiveStatus === 'completed' ? 'Completato' : 'In programma'}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 min-h-[60px]">
                                        <p className="text-sm text-slate-600 italic whitespace-pre-wrap leading-relaxed">
                                            {h.h_notes || 'Nessuna nota registrata per questa seduta.'}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                        {!loadingHistory && history.length === 0 && (
                            <p className="text-center text-slate-400 py-12 italic">Nessun dato storico.</p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
