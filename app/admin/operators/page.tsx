'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { humanError } from '@/lib/humanError';
import { LoadingState, Spinner } from '@/components/ui/Loading';
import { EmptyState, emptyStates } from '@/components/EmptyState';

type Operator = {
    id: string;
    display_name: string;
    commission_rate: number;
    user_id: string | null;
};

type OperatorService = {
    service_id: string;
    service_name: string;
    assigned: boolean;
};

export default function AdminOperatorsPage() {
    const router = useRouter();
    const [operators, setOperators] = useState<Operator[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [email, setEmail] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [commissionRate, setCommissionRate] = useState('20');
    const [saving, setSaving] = useState(false);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editRate, setEditRate] = useState('');


    // Service management state
    const [servicesOpId, setServicesOpId] = useState<string | null>(null);
    const [opServices, setOpServices] = useState<OperatorService[]>([]);
    const [initialOpServices, setInitialOpServices] = useState<OperatorService[]>([]); // Track original state
    const [servicesLoading, setServicesLoading] = useState(false);
    const [servicesSaving, setServicesSaving] = useState(false); // Track saving state

    async function loadOperatorServices(opId: string) {
        setServicesLoading(true);
        const { data, error } = await supabase.rpc('admin_get_operator_services', { p_operator_id: opId });
        if (error) {
            setErr(humanError(error.message));
        } else {
            const services = (data ?? []) as OperatorService[];
            setOpServices(services);
            setInitialOpServices(JSON.parse(JSON.stringify(services))); // Deep copy for comparison
        }
        setServicesLoading(false);
    }

    // Local toggle only
    function toggleServiceLocal(serviceId: string) {
        setOpServices(prev => prev.map(s =>
            s.service_id === serviceId ? { ...s, assigned: !s.assigned } : s
        ));
    }

    async function saveServices() {
        if (!servicesOpId) return;
        setServicesSaving(true);
        setErr(null);

        // Find changed services
        const changes = opServices.filter(current => {
            const original = initialOpServices.find(init => init.service_id === current.service_id);
            return original && original.assigned !== current.assigned;
        });

        if (changes.length === 0) {
            setServicesOpId(null);
            setServicesSaving(false);
            return;
        }

        // Execute updates in parallel
        const promises = changes.map(svc =>
            supabase.rpc('admin_toggle_operator_service', {
                p_operator_id: servicesOpId,
                p_service_id: svc.service_id,
                p_assign: svc.assigned
            })
        );

        const results = await Promise.all(promises);
        const errors = results.filter(r => r.error);

        if (errors.length > 0) {
            setErr(`Si sono verificati ${errors.length} errori durante il salvataggio.`);
        } else {
            setSuccess('Servizi aggiornati con successo!');
            setServicesOpId(null);
        }
        setServicesSaving(false);
    }

    function cancelServices() {
        setServicesOpId(null);
        setOpServices([]);
        setInitialOpServices([]);
    }

    function openServices(opId: string) {
        if (servicesOpId === opId) {
            cancelServices();
        } else {
            setServicesOpId(opId);
            loadOperatorServices(opId);
        }
    }


    async function loadOperators() {
        setLoading(true);
        setErr(null);

        const { data: authData } = await supabase.auth.getUser();
        if (!authData?.user) {
            router.replace('/login');
            return;
        }

        const { data, error } = await supabase
            .from('operators')
            .select('id, display_name, commission_rate, user_id')
            .order('display_name');

        if (error) {
            console.error('Error loading operators:', error); // Log for debugging
            setErr(humanError(error.message));
        } else {
            setOperators(data ?? []);
        }
        setLoading(false);
    }

    useEffect(() => {
        loadOperators();
    }, []);


    function startEdit(op: Operator) {
        setEditingId(op.id);
        setEditName(op.display_name);
        setEditRate(((op.commission_rate ?? 0) * 100).toFixed(0));
    }

    function cancelEdit() {
        setEditingId(null);
        setEditName('');
        setEditRate('');
    }

    async function saveEdit(opId: string) {
        setErr(null);
        setSuccess(null);

        const rate = parseFloat(editRate) / 100;
        if (isNaN(rate) || rate < 0 || rate > 1) {
            setErr('La percentuale commissione deve essere tra 0 e 100.');
            return;
        }

        if (!editName.trim()) {
            setErr('Il nome è obbligatorio.');
            return;
        }

        const { error } = await supabase
            .from('operators')
            .update({
                display_name: editName.trim(),
                commission_rate: rate,
            })
            .eq('id', opId);

        if (error) {
            setErr(humanError(error.message));
            return;
        }

        setSuccess('Operatore aggiornato!');
        setEditingId(null);
        loadOperators();
    }

    // Styles
    const pageStyle: React.CSSProperties = { padding: '16px' };
    const titleStyle: React.CSSProperties = { fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Poppins, sans-serif', marginBottom: '16px' };
    const sectionTitle: React.CSSProperties = { fontSize: '1rem', fontWeight: 600, marginBottom: '12px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' };
    const tableContainer: React.CSSProperties = { overflowX: 'auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' };
    const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' };
    const thStyle: React.CSSProperties = { textAlign: 'left', padding: '12px', fontWeight: 600, color: '#475569', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' };
    const tdStyle: React.CSSProperties = { padding: '12px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' };
    const badgeYes: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: '#d1fae5', color: '#065f46', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600 };
    const badgeNo: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: '#fef3c7', color: '#92400e', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600 };
    const editBtn: React.CSSProperties = { background: 'transparent', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '0.8rem' };
    const saveBtn: React.CSSProperties = { background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', marginRight: '6px' };
    const cancelBtn: React.CSSProperties = { background: '#94a3b8', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer' };
    const inlineInput: React.CSSProperties = { padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.875rem' };

    if (loading) {
        return <div style={pageStyle}><LoadingState /></div>;
    }

    return (
        <div style={pageStyle}>
            <h1 style={titleStyle}>Gestione Operatori</h1>


            {
                operators.length === 0 ? (
                    <EmptyState {...emptyStates.noOperators} />
                ) : (

                    <div className="space-y-4">
                        {/* Header Desktop */}
                        <div className="hidden md:grid md:grid-cols-12 md:gap-4 px-4 py-2 font-semibold text-slate-500 border-b border-slate-200 bg-slate-50 rounded-t-lg">
                            <div className="md:col-span-4 pl-2">Nome</div>
                            <div className="md:col-span-2 text-center">Commissione</div>
                            <div className="md:col-span-2 text-center">Account</div>
                            <div className="md:col-span-4 text-right pr-2">Azioni</div>
                        </div>

                        {operators.map((op) => (
                            <div key={op.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                <div className="p-4 flex flex-col gap-3 md:grid md:grid-cols-12 md:gap-4 md:items-center">
                                    {editingId === op.id ? (
                                        <>
                                            {/* EDIT MODE */}
                                            <div className="md:col-span-4 w-full">
                                                <label className="block text-xs text-slate-400 mb-1 md:hidden">Nome</label>
                                                <input
                                                    type="text"
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                />
                                            </div>
                                            <div className="md:col-span-2 text-center flex items-center justify-between md:justify-center">
                                                <label className="text-sm text-slate-500 md:hidden">Commissione:</label>
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        className="w-16 px-2 py-1 text-center border border-slate-300 rounded-lg text-sm"
                                                        value={editRate}
                                                        onChange={(e) => setEditRate(e.target.value)}
                                                    />
                                                    <span className="text-slate-500">%</span>
                                                </div>
                                            </div>
                                            <div className="md:col-span-2 text-center flex justify-between md:justify-center items-center">
                                                <label className="text-sm text-slate-500 md:hidden">Account:</label>
                                                <div className="opacity-50">
                                                    {op.user_id ? <span style={badgeYes}>✓ Sì</span> : <span style={badgeNo}>✗ No</span>}
                                                </div>
                                            </div>
                                            <div className="md:col-span-4 text-right flex gap-2 justify-end mt-2 md:mt-0">
                                                <button onClick={() => saveEdit(op.id)} style={saveBtn}>✓ Salva</button>
                                                <button onClick={cancelEdit} style={cancelBtn}>✗</button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            {/* READ MODE */}
                                            <div className="md:col-span-4 flex justify-between items-start w-full">
                                                <span className="font-semibold text-slate-800">{op.display_name}</span>
                                                {/* Mobile Badge */}
                                                <div className="md:hidden">
                                                    {op.user_id ? <span style={badgeYes}>✓ Sì</span> : <span style={badgeNo}>✗ No</span>}
                                                </div>
                                            </div>

                                            <div className="md:col-span-2 flex justify-between items-center md:justify-center w-full">
                                                <span className="text-sm text-slate-500 md:hidden">Commissione:</span>
                                                <span className="font-medium text-slate-700">{((op.commission_rate ?? 0) * 100).toFixed(0)}%</span>
                                            </div>

                                            <div className="md:col-span-2 hidden md:flex justify-center">
                                                {op.user_id ? <span style={badgeYes}>✓ Sì</span> : <span style={badgeNo}>✗ No</span>}
                                            </div>

                                            <div className="md:col-span-4 flex justify-end gap-2 w-full mt-2 md:mt-0">
                                                <button onClick={() => startEdit(op)} style={{ ...editBtn, marginRight: '0' }} className="flex items-center gap-1">
                                                    ✏️ <span className="md:hidden">Modifica</span>
                                                </button>
                                                <button
                                                    onClick={() => openServices(op.id)}
                                                    style={{
                                                        ...editBtn,
                                                        background: servicesOpId === op.id ? '#fef3c7' : 'transparent'
                                                    }}
                                                    className="flex items-center gap-1"
                                                >
                                                    🏷️ <span className="md:show">Servizi</span>
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* SERVICES EXPANSION */}
                                {servicesOpId === op.id && (
                                    <div className="bg-slate-50 border-t border-slate-100 p-4 animate-in slide-in-from-top-2 duration-200">
                                        <h4 className="text-xs font-semibold uppercase text-slate-400 mb-3 tracking-wider">
                                            Servizi Abilitati
                                        </h4>
                                        {servicesLoading ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b' }}>
                                                <Spinner size="sm" /> Caricamento servizi...
                                            </div>
                                        ) : (

                                            <div className="flex flex-col gap-4">
                                                <div className="flex flex-wrap gap-2">
                                                    {opServices.length === 0 && <span className="text-sm text-slate-400 italic">Nessun servizio.</span>}
                                                    {opServices.map(svc => (
                                                        <label
                                                            key={svc.service_id}
                                                            className={`
                                                        flex items-center gap-2 px-3 py-2 rounded-full border text-sm cursor-pointer transition-colors
                                                        ${svc.assigned
                                                                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                                                                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}
                                                    `}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={svc.assigned}
                                                                onChange={() => toggleServiceLocal(svc.service_id)}
                                                                className="accent-emerald-500 w-4 h-4"
                                                            />
                                                            {svc.service_name}
                                                        </label>
                                                    ))}
                                                </div>
                                                <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                                                    <button
                                                        onClick={cancelServices}
                                                        className="px-4 py-2 text-sm font-medium text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                                                    >
                                                        Annulla
                                                    </button>
                                                    <button
                                                        onClick={saveServices}
                                                        disabled={servicesSaving}
                                                        className="px-4 py-2 text-sm font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-2"
                                                    >
                                                        {servicesSaving ? <Spinner size="sm" /> : '✓'} Salva Modifiche
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )
            }
        </div >
    );
}
