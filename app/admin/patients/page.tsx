'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { humanError } from '@/lib/humanError';
import { LoadingState } from '@/components/ui/Loading';

interface Patient {
    p_id: string;
    p_display_name: string;
    p_last_visit: string;
    p_total_appointments: number;
}

export default function AdminPatientsPage() {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter state
    const [showMyOnly, setShowMyOnly] = useState(false);
    const [myOperatorId, setMyOperatorId] = useState<string | null>(null);

    // Fetch current admin's operator ID
    useEffect(() => {
        async function getMyOpId() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('operators').select('id').eq('user_id', user.id).single();
                if (data) setMyOperatorId(data.id);
            }
        }
        getMyOpId();
    }, []);

    useEffect(() => {
        async function loadPatients() {
            setLoading(true);
            const filterOpId = showMyOnly ? myOperatorId : null;

            const { data, error } = await supabase.rpc('admin_get_patients', { p_operator_id: filterOpId });

            if (error) {
                setError(humanError(error.message));
            } else {
                setPatients((data ?? []) as Patient[]);
            }
            setLoading(false);
        }
        loadPatients();
    }, [showMyOnly, myOperatorId]);

    if (loading) return <div className="p-6"><LoadingState /></div>;

    return (
        <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto pb-24">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 font-[Poppins]">Pazienti</h1>
                    <p className="text-sm text-slate-500">Lista completa anagrafica</p>
                </div>
                {myOperatorId && (
                    <button
                        onClick={() => setShowMyOnly(!showMyOnly)}
                        className={`px-3 py-2 rounded-xl text-sm font-bold border transition-all ${showMyOnly
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-200'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                            }`}
                    >
                        👤 Solo Miei
                    </button>
                )}
            </header>

            {error && <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">⚠️ {error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {patients.map((p) => (
                    <Link
                        key={p.p_id}
                        href={`/admin/patients/${p.p_id}`}
                        className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:border-amber-400 transition-all group flex justify-between items-center block"
                    >
                        <div>
                            <h3 className="font-bold text-slate-800 group-hover:text-amber-500 transition-colors">{p.p_display_name}</h3>
                            <p className="text-xs text-slate-400 mt-1 italic">Ultimo incontro: {p.p_last_visit ? new Date(p.p_last_visit).toLocaleDateString() : 'Mai'}</p>
                        </div>
                        <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100 whitespace-nowrap">
                            {p.p_total_appointments} appt.
                        </span>
                    </Link>
                ))}
                {patients.length === 0 && (
                    <div className="col-span-full py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <p className="text-slate-400 text-xs italic">Nessun paziente trovato con i filtri attuali.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
