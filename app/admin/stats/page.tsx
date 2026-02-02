'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { humanError } from '@/lib/humanError';
import { LoadingState } from '@/components/ui/Loading';
import { eur } from '@/lib/format';
import { KpiCard, KpiGrid } from '@/components/ui/KpiCard';

import { CommissionsTable } from './CommissionsTable';

interface RevenueTrend {
    month: string;
    year_month: string;
    revenue_cents: number;
    appointment_count: number;
}

interface ServiceMix {
    service_name: string;
    count: number;
    revenue_cents: number;
    percentage_count: number;
}

interface PatientStats {
    total_patients: number;
    new_patients: number;
}

// Add interface for Commission Summary
interface CommissionSummary {
    operator_id: string;
    operator_name: string;
    num_appointments: number;
    total_gross_cents: number;
    total_commission_cents: number;
    total_net_cents: number;
}

export default function AdminStatsPage() {
    const [trend, setTrend] = useState<RevenueTrend[]>([]);
    const [mix, setMix] = useState<ServiceMix[]>([]);
    const [patients, setPatients] = useState<PatientStats | null>(null);
    const [commissions, setCommissions] = useState<CommissionSummary[]>([]); // New State

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
        async function loadStats() {
            setLoading(true);
            setError(null);

            const today = new Date();
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(today.getDate() - 90);

            // Determine if we should filter
            const filterOpId = showMyOnly ? myOperatorId : null;

            // Format current month for commissions RPC (YYYY-MM)
            const currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

            try {
                const [trendRes, mixRes, patientsRes, commRes] = await Promise.all([
                    supabase.rpc('admin_get_revenue_trend', { p_operator_id: filterOpId }),
                    supabase.rpc('admin_get_service_mix', {
                        p_start_date: ninetyDaysAgo.toISOString(),
                        p_end_date: today.toISOString(),
                        p_operator_id: filterOpId
                    }),
                    supabase.rpc('admin_get_patient_stats', {
                        p_start_date: ninetyDaysAgo.toISOString(),
                        p_end_date: today.toISOString(),
                        p_operator_id: filterOpId
                    }),
                    // Fetch Commissions Summary
                    supabase.rpc('admin_month_summary', {
                        p_year_month: currentYearMonth
                    })
                ]);

                if (trendRes.error || mixRes.error || patientsRes.error || commRes.error) {
                    const msg = trendRes.error?.message || mixRes.error?.message || patientsRes.error?.message || commRes.error?.message;
                    setError(humanError(msg || 'Errore nel caricamento statistiche'));
                } else {
                    // CASTING STRINGADONI BIGINT IN NUMERI VERI (ESENZIALE PER I GRAFICI)
                    const trendData = (trendRes.data || []).map((t: any) => ({
                        ...t,
                        revenue_cents: Number(t.revenue_cents || 0),
                        appointment_count: Number(t.appointment_count || 0)
                    }));
                    setTrend(trendData);

                    setMix((mixRes.data || []).map((m: any) => ({
                        ...m,
                        revenue_cents: Number(m.revenue_cents || 0),
                        count: Number(m.count || 0),
                        percentage_count: Number(m.percentage_count || 0)
                    })));

                    setPatients(patientsRes.data?.[0] || null);

                    // Set Commissions Data
                    // Apply filtering client-side if "My Only" is active, since RPC admin_month_summary gets everyone
                    let commData = (commRes.data || []).map((c: any) => ({
                        ...c,
                        num_appointments: Number(c.num_appointments || 0),
                        total_gross_cents: Number(c.total_gross_cents || 0),
                        total_commission_cents: Number(c.total_commission_cents || 0),
                        total_net_cents: Number(c.total_net_cents || 0)
                    }));

                    if (showMyOnly && myOperatorId) {
                        commData = commData.filter((c: any) => c.operator_id === myOperatorId);
                    }

                    setCommissions(commData);
                }
            } catch (err: any) {
                setError(humanError(err.message));
            } finally {
                setLoading(false);
            }
        }

        loadStats();
    }, [showMyOnly, myOperatorId]);

    const currentMonth = useMemo(() => trend[trend.length - 1], [trend]);
    const returningPatients = useMemo(() => (patients?.total_patients || 0) - (patients?.new_patients || 0), [patients]);
    const retentionRate = useMemo(() =>
        patients?.total_patients ? Math.round((returningPatients / patients.total_patients) * 100) : 0
        , [patients, returningPatients]);

    if (loading) return <div className="p-8"><LoadingState /></div>;

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-8 pb-32 mt-6">
            <header className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 font-[Poppins]">Analisi Studio</h1>
                    <p className="text-sm text-slate-500 font-medium">Performance aggiornate in tempo reale</p>
                </div>
                {myOperatorId && (
                    <button
                        onClick={() => setShowMyOnly(!showMyOnly)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${showMyOnly
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-200'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                            }`}
                    >
                        👤 Solo Miei
                    </button>
                )}
            </header>

            {error && (
                <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-2xl text-sm font-bold">
                    ⚠️ {error}
                </div>
            )}

            {/* KPI Overview */}
            <KpiGrid>
                <KpiCard
                    value={eur(currentMonth?.revenue_cents || 0)}
                    label={`Fatturato ${currentMonth?.month || 'Corrente'}`}
                    highlight
                    icon="💰"
                />
                <KpiCard
                    value={currentMonth?.appointment_count || 0}
                    label="Volume Appuntamenti"
                    icon="📅"
                />
                <KpiCard
                    value={`${retentionRate}%`}
                    label="Tasso Ritorno"
                    icon="🔁"
                />
                <KpiCard
                    value={patients?.total_patients || 0}
                    label="Pazienti Unici (90gg)"
                    icon="👥"
                />
            </KpiGrid>

            {/* REVENUE TREND - IL CUORE DEL FIX */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl flex flex-col">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-lg font-black text-slate-900 tracking-tight">📈 Andamento Fatturato</h2>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Ultimi 12 mesi dello studio</p>
                    </div>
                </div>

                {/* GRAFICO CON ALTEZZA FISSA MATEMATICA */}
                <div className="w-full flex items-end justify-between h-[300px] gap-2 px-1 border-b-4 border-slate-100 pb-2">
                    {trend.length > 0 ? (() => {
                        const maxVal = Math.max(...trend.map(t => t.revenue_cents), 1);
                        const CHART_MAX_PX = 250; // Massima altezza delle barre in pixel

                        return trend.map((t) => {
                            const val = t.revenue_cents;
                            // Se c'è valore, minimo 40px altrimenti 10px per struttura
                            const barHeight = val > 0
                                ? Math.max((val / maxVal) * CHART_MAX_PX, 40)
                                : 10;

                            const date = new Date(t.year_month + '-01');
                            const monthName = date.toLocaleString('it-IT', { month: 'short' }).toUpperCase();

                            return (
                                <div key={t.year_month} className="flex-1 flex flex-col justify-end items-center group relative h-full">
                                    {/* TOOLTIP GIGANTE PER ADMIN */}
                                    <div className="absolute bottom-full mb-4 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-slate-900 scale-90 group-hover:scale-100 text-white p-4 rounded-[1.5rem] pointer-events-none z-50 shadow-[0_20px_50px_rgba(0,0,0,0.3)] origin-bottom text-center min-w-[140px]">
                                        <p className="text-[10px] font-black text-slate-500 mb-1 tracking-widest">{monthName} {t.year_month.split('-')[0]}</p>
                                        <p className="text-2xl font-black text-orange-400 leading-none">{eur(val)}</p>
                                        <div className="h-px bg-white/10 my-3" />
                                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">{t.appointment_count} appuntamenti</p>
                                    </div>

                                    {/* LA BARRA - COLORE ARANCIO STUDIO FISYO */}
                                    <div
                                        className={`w-full relative transition-all duration-1000 ease-out cursor-pointer rounded-t-2xl ${val > 0 ? 'bg-orange-500 shadow-[0_10px_20px_rgba(249,115,22,0.3)]' : 'bg-slate-200'}`}
                                        style={{ height: `${barHeight}px` }}
                                    >
                                        {val > 0 && (
                                            <div className="w-full h-full bg-gradient-to-t from-orange-600 to-amber-300 rounded-t-2xl relative overflow-hidden">
                                                {/* Luce dall'alto */}
                                                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent" />
                                            </div>
                                        )}
                                    </div>

                                    <span className="text-[10px] md:text-xs text-slate-500 mt-4 font-black tracking-tighter uppercase">
                                        {monthName}
                                    </span>
                                </div>
                            );
                        });
                    })() : (
                        <div className="flex-1 h-full flex items-center justify-center text-slate-300 italic">
                            Caricamento dati grafico...
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* FIDELIZZAZIONE */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl flex flex-col items-center justify-center text-center">
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-10 w-full text-left">👥 Fidelizzazione Pazienti</h2>

                    <div className="relative w-56 h-56 mb-8">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
                            <circle
                                cx="18" cy="18" r="15.915"
                                fill="none"
                                stroke="url(#retentionGradient)"
                                strokeWidth="3.5"
                                strokeDasharray={`${retentionRate}, 100`}
                                strokeLinecap="round"
                                className="transition-all duration-1000 ease-out shadow-lg"
                            />
                            <defs>
                                <linearGradient id="retentionGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#f59e0b" />
                                    <stop offset="100%" stopColor="#d97706" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-5xl font-black text-slate-900 leading-none">{retentionRate}%</span>
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest mt-2">Ritorno</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8 w-full pt-8 border-t border-slate-50">
                        <div>
                            <p className="text-xs text-slate-400 font-black uppercase mb-1">Nuovi</p>
                            <p className="text-2xl font-black text-slate-900">{patients?.new_patients || 0}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 font-black uppercase mb-1">Ricorrenti</p>
                            <p className="text-2xl font-black text-slate-900">{returningPatients}</p>
                        </div>
                    </div>
                </div>

                {/* MIX SERVIZI */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl">
                    <div className="flex justify-between items-center mb-10">
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">🍩 Analisi Servizi</h2>
                        <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-3 py-1 rounded-full ring-1 ring-slate-100 uppercase">90 GIORNI</span>
                    </div>

                    <div className="space-y-6">
                        {mix.length > 0 ? mix.map((item, idx) => (
                            <div key={idx} className="group">
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-xs font-extrabold text-slate-700 uppercase tracking-tight">{item.service_name}</span>
                                    <span className="text-sm font-black text-slate-900">{eur(item.revenue_cents)}</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden shadow-inner">
                                    <div
                                        className="bg-gradient-to-r from-orange-400 to-amber-500 h-full rounded-full transition-all duration-1000 origin-left"
                                        style={{ width: `${item.percentage_count}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between mt-2 text-[10px] font-bold uppercase tracking-widest">
                                    <span className="text-slate-400">{item.count} SEDUTE</span>
                                    <span className="text-amber-600">{item.percentage_count}% DEL VOLUME</span>
                                </div>
                            </div>
                        )) : (
                            <div className="py-12 text-center text-slate-400 italic text-sm font-medium">
                                Nessun dato sui servizi in questo periodo
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* NEW COMMISSIONS RECAP */}
            <CommissionsTable data={commissions} isLoading={loading} />

            <footer className="text-center pt-8">
                <p className="text-[10px] text-slate-400 leading-relaxed font-black uppercase tracking-[0.2em] opacity-50">
                    Studio FISYO Ledger • Dashboard Amministrativa
                </p>
            </footer>
        </div>
    );
}
