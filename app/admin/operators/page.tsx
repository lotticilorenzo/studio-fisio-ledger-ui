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
    const [servicesLoading, setServicesLoading] = useState(false);

    async function loadOperatorServices(opId: string) {
        setServicesLoading(true);
        const { data, error } = await supabase.rpc('admin_get_operator_services', { p_operator_id: opId });
        if (error) {
            setErr(humanError(error.message));
        } else {
            setOpServices((data ?? []) as OperatorService[]);
        }
        setServicesLoading(false);
    }

    async function toggleService(opId: string, serviceId: string, currentlyAssigned: boolean) {
        const { error } = await supabase.rpc('admin_toggle_operator_service', {
            p_operator_id: opId,
            p_service_id: serviceId,
            p_assign: !currentlyAssigned
        });
        if (error) {
            setErr(humanError(error.message));
        } else {
            // Update local state
            setOpServices(prev => prev.map(s =>
                s.service_id === serviceId ? { ...s, assigned: !currentlyAssigned } : s
            ));
            setSuccess(`Servizio ${!currentlyAssigned ? 'assegnato' : 'rimosso'}!`);
        }
    }

    function openServices(opId: string) {
        if (servicesOpId === opId) {
            setServicesOpId(null);
            setOpServices([]);
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
            setErr(humanError(error.message));
        } else {
            setOperators(data ?? []);
        }
        setLoading(false);
    }

    useEffect(() => {
        loadOperators();
    }, []);

    async function linkUser(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setErr(null);
        setSuccess(null);

        if (!email.trim() || !displayName.trim()) {
            setErr('Email e nome sono obbligatori.');
            setSaving(false);
            return;
        }

        const rate = parseFloat(commissionRate) / 100;
        if (isNaN(rate) || rate < 0 || rate > 1) {
            setErr('La percentuale commissione deve essere tra 0 e 100.');
            setSaving(false);
            return;
        }

        const { error } = await supabase.rpc('admin_link_user_to_operator', {
            p_user_email: email.trim(),
            p_display_name: displayName.trim(),
            p_commission_rate: rate,
        });

        if (error) {
            if (error.message.includes('user_not_found')) {
                setErr(`Utente con email "${email}" non trovato. L'utente deve prima registrarsi.`);
            } else {
                setErr(humanError(error.message));
            }
            setSaving(false);
            return;
        }

        setSuccess(`Operatore "${displayName}" collegato con successo!`);
        setEmail('');
        setDisplayName('');
        setCommissionRate('20');
        setSaving(false);
        loadOperators();
    }

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
    const cardStyle: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '24px' };
    const cardTitleStyle: React.CSSProperties = { fontSize: '1rem', fontWeight: 600, color: '#0f172a', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' };
    const hintStyle: React.CSSProperties = { fontSize: '0.875rem', color: '#64748b', marginBottom: '16px' };
    const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#475569', marginBottom: '6px' };
    const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '1rem', minHeight: '48px', marginBottom: '16px' };
    const btnPrimary: React.CSSProperties = { width: '100%', background: 'linear-gradient(135deg, #f4f119 0%, #ff9900 100%)', color: '#0f172a', border: 'none', borderRadius: '8px', padding: '14px 20px', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' };
    const sectionTitle: React.CSSProperties = { fontSize: '1rem', fontWeight: 600, marginBottom: '12px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' };
    const tableContainer: React.CSSProperties = { overflowX: 'auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' };
    const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' };
    const thStyle: React.CSSProperties = { textAlign: 'left', padding: '12px', fontWeight: 600, color: '#475569', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' };
    const tdStyle: React.CSSProperties = { padding: '12px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' };
    const errorBox: React.CSSProperties = { background: '#fee2e2', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px', color: '#991b1b', marginBottom: '16px', fontSize: '0.875rem' };
    const successBox: React.CSSProperties = { background: '#d1fae5', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', padding: '12px', color: '#065f46', marginBottom: '16px', fontSize: '0.875rem' };
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

            {/* Form nuovo operatore */}
            <div style={cardStyle}>
                <h2 style={cardTitleStyle}>➕ Collega Nuovo Operatore</h2>
                <p style={hintStyle}>
                    L&apos;utente deve già essersi registrato. Questa funzione collega l&apos;account esistente come operatore.
                </p>

                <form onSubmit={linkUser}>
                    <label style={labelStyle}>Email utente (già registrato)</label>
                    <input
                        type="email"
                        style={inputStyle}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="operatore@esempio.com"
                        required
                    />

                    <label style={labelStyle}>Nome visualizzato</label>
                    <input
                        type="text"
                        style={inputStyle}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Es. Dott. Mario Rossi"
                        required
                    />

                    <label style={labelStyle}>Commissione studio (%)</label>
                    <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        style={inputStyle}
                        value={commissionRate}
                        onChange={(e) => setCommissionRate(e.target.value)}
                        placeholder="20"
                    />
                    <p style={{ ...hintStyle, marginTop: '-8px' }}>Percentuale trattenuta dallo studio su ogni visita.</p>

                    {err && <div style={errorBox}>⚠️ {err}</div>}
                    {success && <div style={successBox}>✓ {success}</div>}

                    <button type="submit" disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>
                        {saving ? <><Spinner size="sm" /> Collego...</> : 'Collega Operatore'}
                    </button>
                </form>
            </div>

            {/* Lista operatori */}
            <h2 style={sectionTitle}>👥 Operatori Attuali</h2>

            {operators.length === 0 ? (
                <EmptyState {...emptyStates.noOperators} />
            ) : (
                <div style={tableContainer}>
                    <table style={tableStyle}>
                        <thead>
                            <tr>
                                <th style={thStyle}>Nome</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Commissione</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Account</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Azioni</th>
                            </tr>
                        </thead>
                        <tbody>
                            {operators.map((op) => (
                                <React.Fragment key={op.id}>
                                    <tr>
                                        {editingId === op.id ? (
                                            <>
                                                <td style={tdStyle}>
                                                    <input
                                                        type="text"
                                                        style={{ ...inlineInput, width: '100%' }}
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                    />
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        style={{ ...inlineInput, width: '60px', textAlign: 'center' }}
                                                        value={editRate}
                                                        onChange={(e) => setEditRate(e.target.value)}
                                                    />
                                                    <span style={{ marginLeft: '4px' }}>%</span>
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                    {op.user_id ? <span style={badgeYes}>✓ Sì</span> : <span style={badgeNo}>✗ No</span>}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                    <button onClick={() => saveEdit(op.id)} style={saveBtn}>✓</button>
                                                    <button onClick={cancelEdit} style={cancelBtn}>✗</button>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td style={{ ...tdStyle, fontWeight: 500 }}>{op.display_name}</td>
                                                <td style={{ ...tdStyle, textAlign: 'center' }}>{((op.commission_rate ?? 0) * 100).toFixed(0)}%</td>
                                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                    {op.user_id ? (
                                                        <span style={badgeYes}>✓ Sì</span>
                                                    ) : (
                                                        <span style={badgeNo}>✗ No</span>
                                                    )}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                    <button onClick={() => startEdit(op)} style={{ ...editBtn, marginRight: '6px' }}>
                                                        ✏️
                                                    </button>
                                                    <button
                                                        onClick={() => openServices(op.id)}
                                                        style={{
                                                            ...editBtn,
                                                            background: servicesOpId === op.id ? '#fef3c7' : 'transparent'
                                                        }}
                                                    >
                                                        🏷️ Servizi
                                                    </button>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                    {/* Expandable services row */}
                                    {servicesOpId === op.id && (
                                        <tr>
                                            <td colSpan={4} style={{ padding: '12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                {servicesLoading ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b' }}>
                                                        <Spinner size="sm" /> Caricamento servizi...
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                        {opServices.map(svc => (
                                                            <label
                                                                key={svc.service_id}
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '6px',
                                                                    padding: '6px 12px',
                                                                    background: svc.assigned ? '#d1fae5' : '#fff',
                                                                    border: `1px solid ${svc.assigned ? '#10b981' : '#e2e8f0'}`,
                                                                    borderRadius: '20px',
                                                                    cursor: 'pointer',
                                                                    fontSize: '0.8rem'
                                                                }}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={svc.assigned}
                                                                    onChange={() => toggleService(op.id, svc.service_id, svc.assigned)}
                                                                    style={{ accentColor: '#10b981' }}
                                                                />
                                                                {svc.service_name}
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
