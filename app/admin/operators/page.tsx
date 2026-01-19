'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { humanError } from '@/lib/humanError';

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

    // Form state for new operator
    const [email, setEmail] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [commissionRate, setCommissionRate] = useState('20');
    const [saving, setSaving] = useState(false);

    // Edit state
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    return (
        <main className="p-4 md:p-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between gap-4">
                <h1 className="text-xl md:text-2xl font-semibold">Gestione Operatori</h1>
            </div>

            {/* Form nuovo operatore */}
            <div className="mt-6 border rounded-lg p-4">
                <h2 className="text-lg font-medium mb-4">➕ Collega Nuovo Operatore</h2>
                <p className="text-sm opacity-70 mb-4">
                    L'utente deve già essersi registrato (email/password). Questa funzione collega l'account esistente come operatore.
                </p>

                <form onSubmit={linkUser} className="space-y-4">
                    <div>
                        <label className="block text-sm mb-1">Email utente (già registrato)</label>
                        <input
                            type="email"
                            className="input-field"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="operatore@esempio.com"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm mb-1">Nome visualizzato</label>
                        <input
                            type="text"
                            className="input-field"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Es. Dott. Mario Rossi"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm mb-1">Commissione studio (%)</label>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            className="input-field"
                            value={commissionRate}
                            onChange={(e) => setCommissionRate(e.target.value)}
                            placeholder="20"
                        />
                        <p className="text-xs opacity-70 mt-1">
                            Percentuale trattenuta dallo studio su ogni visita.
                        </p>
                    </div>

                    {err && (
                        <div className="rounded border border-red-500 bg-red-500/10 p-3 text-sm text-red-200">
                            {err}
                        </div>
                    )}

                    {success && (
                        <div className="rounded border border-green-500 bg-green-500/10 p-3 text-sm text-green-200">
                            {success}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={saving}
                        className="btn btn-primary w-full disabled:opacity-50"
                    >
                        {saving ? 'Collego...' : 'Collega Operatore'}
                    </button>
                </form>
            </div>

            {/* Lista operatori esistenti */}
            <div className="mt-8">
                <h2 className="text-lg font-medium mb-4">👥 Operatori Attuali</h2>

                {loading && <p className="text-center py-4">Caricamento...</p>}

                {!loading && operators.length === 0 && (
                    <p className="text-center py-4 opacity-70">Nessun operatore configurato.</p>
                )}

                {!loading && operators.length > 0 && (
                    <div className="table-responsive">
                        <table className="min-w-full text-sm">
                            <thead className="border-b bg-white/5">
                                <tr>
                                    <th className="text-left p-3">Nome</th>
                                    <th className="text-right p-3">Commissione</th>
                                    <th className="text-center p-3">Account</th>
                                    <th className="text-center p-3">Azioni</th>
                                </tr>
                            </thead>
                            <tbody>
                                {operators.map((op) => (
                                    <tr key={op.id} className="border-b">
                                        {editingId === op.id ? (
                                            <>
                                                <td className="p-2">
                                                    <input
                                                        type="text"
                                                        className="w-full border rounded px-2 py-1 bg-transparent"
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        className="w-20 border rounded px-2 py-1 bg-transparent text-right"
                                                        value={editRate}
                                                        onChange={(e) => setEditRate(e.target.value)}
                                                    />
                                                    <span className="ml-1">%</span>
                                                </td>
                                                <td className="p-2 text-center">
                                                    {op.user_id ? (
                                                        <span className="text-green-400">✓</span>
                                                    ) : (
                                                        <span className="text-yellow-400">✗</span>
                                                    )}
                                                </td>
                                                <td className="p-2 text-center">
                                                    <button
                                                        onClick={() => saveEdit(op.id)}
                                                        className="px-2 py-1 rounded bg-green-600 text-white text-xs mr-1"
                                                    >
                                                        ✓
                                                    </button>
                                                    <button
                                                        onClick={cancelEdit}
                                                        className="px-2 py-1 rounded bg-gray-600 text-white text-xs"
                                                    >
                                                        ✗
                                                    </button>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="p-3 font-medium">{op.display_name}</td>
                                                <td className="p-3 text-right">{((op.commission_rate ?? 0) * 100).toFixed(0)}%</td>
                                                <td className="p-3 text-center">
                                                    {op.user_id ? (
                                                        <span className="text-green-400">✓ Sì</span>
                                                    ) : (
                                                        <span className="text-yellow-400">✗ No</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <button
                                                        onClick={() => startEdit(op)}
                                                        className="px-2 py-1 rounded border text-xs hover:bg-white/10"
                                                    >
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
        </main>
    );
}

