'use client';

import { useEffect, useState } from 'react';
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

    if (loading) {
        return <LoadingState />;
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <h1 className="page-title">Gestione Operatori</h1>
            </div>

            {/* Form nuovo operatore */}
            <div className="card card-body mb-6">
                <h2 className="section-title">➕ Collega Nuovo Operatore</h2>
                <p className="text-sm text-muted mb-4">
                    L&apos;utente deve già essersi registrato. Questa funzione collega l&apos;account esistente come operatore.
                </p>

                <form onSubmit={linkUser}>
                    <div className="form-group">
                        <label className="form-label">Email utente (già registrato)</label>
                        <input
                            type="email"
                            className="form-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="operatore@esempio.com"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Nome visualizzato</label>
                        <input
                            type="text"
                            className="form-input"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Es. Dott. Mario Rossi"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Commissione studio (%)</label>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            className="form-input"
                            value={commissionRate}
                            onChange={(e) => setCommissionRate(e.target.value)}
                            placeholder="20"
                        />
                        <p className="form-hint">Percentuale trattenuta dallo studio su ogni visita.</p>
                    </div>

                    {err && <div className="error-box mb-4">{err}</div>}
                    {success && <div className="success-box mb-4">{success}</div>}

                    <button type="submit" disabled={saving} className="btn btn-primary btn-full">
                        {saving ? <><Spinner size="sm" /> Collego...</> : 'Collega Operatore'}
                    </button>
                </form>
            </div>

            {/* Lista operatori */}
            <div>
                <h2 className="section-title">👥 Operatori Attuali</h2>

                {operators.length === 0 ? (
                    <EmptyState {...emptyStates.noOperators} />
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Nome</th>
                                    <th style={{ textAlign: 'right' }}>Commissione</th>
                                    <th style={{ textAlign: 'center' }}>Account</th>
                                    <th style={{ textAlign: 'center' }}>Azioni</th>
                                </tr>
                            </thead>
                            <tbody>
                                {operators.map((op) => (
                                    <tr key={op.id}>
                                        {editingId === op.id ? (
                                            <>
                                                <td>
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        style={{ minHeight: '36px', padding: 'var(--space-2)' }}
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                    />
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        className="form-input"
                                                        style={{ width: '80px', minHeight: '36px', padding: 'var(--space-2)', textAlign: 'right' }}
                                                        value={editRate}
                                                        onChange={(e) => setEditRate(e.target.value)}
                                                    />
                                                    <span className="ml-1">%</span>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    {op.user_id ? <span className="text-success">✓</span> : <span className="text-warning">✗</span>}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <button onClick={() => saveEdit(op.id)} className="btn btn-sm" style={{ background: 'var(--success)', color: 'white', marginRight: 'var(--space-2)' }}>
                                                        ✓
                                                    </button>
                                                    <button onClick={cancelEdit} className="btn btn-ghost btn-sm">
                                                        ✕
                                                    </button>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="font-medium">{op.display_name}</td>
                                                <td style={{ textAlign: 'right' }}>{((op.commission_rate ?? 0) * 100).toFixed(0)}%</td>
                                                <td style={{ textAlign: 'center' }}>
                                                    {op.user_id ? (
                                                        <span className="text-success">✓ Sì</span>
                                                    ) : (
                                                        <span style={{ color: 'var(--warning)' }}>✗ No</span>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <button onClick={() => startEdit(op)} className="btn btn-ghost btn-sm">
                                                        ✏️ Modifica
                                                    </button>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
