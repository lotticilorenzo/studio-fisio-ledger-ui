import { eur } from '@/lib/format';

interface CommissionSummary {
    operator_id: string;
    operator_name: string;
    num_appointments: number;
    total_gross_cents: number;
    total_commission_cents: number;
    total_net_cents: number;
}

interface Props {
    data: CommissionSummary[];
    isLoading: boolean;
}

export function CommissionsTable({ data, isLoading }: Props) {
    if (isLoading) {
        return (
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl flex items-center justify-center min-h-[200px]">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-orange-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    // Sort: Collaborators who owe money first, then by amount descending
    const sortedData = [...data].sort((a, b) => b.total_commission_cents - a.total_commission_cents);

    return (
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight">💰 Riepilogo Commissioni Studio</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                        Mese Corrente • Quanto devono versare i collaboratori
                    </p>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr>
                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pl-4">Operatore</th>
                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 text-center">Appuntamenti</th>
                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 text-right">Incassato (Lordo)</th>
                            <th className="pb-4 text-[10px] font-black text-slate-900 uppercase tracking-widest border-b border-slate-50 text-right pr-4 bg-orange-50/50 rounded-tr-xl">Commissione Studio</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {sortedData.length > 0 ? (
                            sortedData.map((row) => (
                                <tr key={row.operator_id} className="group hover:bg-slate-50/50 transition-colors">
                                    <td className="py-4 pl-4 font-bold text-slate-800 border-b border-slate-50">
                                        {row.operator_name}
                                    </td>
                                    <td className="py-4 text-center text-slate-500 font-medium border-b border-slate-50">
                                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-xs font-bold">
                                            {row.num_appointments}
                                        </span>
                                    </td>
                                    <td className="py-4 text-right text-slate-500 font-medium border-b border-slate-50">
                                        {eur(row.total_gross_cents)}
                                    </td>
                                    <td className="py-4 text-right pr-4 border-b border-slate-50 bg-orange-50/30 group-hover:bg-orange-50/60 transition-colors">
                                        <span className="font-black text-orange-600 text-base">
                                            {eur(row.total_commission_cents)}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={4} className="py-8 text-center text-slate-400 italic font-medium">
                                    Nessun dato disponibile per questo mese.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-50 text-[10px] text-slate-400 font-medium leading-relaxed">
                * La "Commissione Studio" è l'importo calcolato in base alla percentuale concordata con l'operatore (es. 20% o 50%).
                Questo è l'importo che il collaboratore deve versare allo studio a fine mese.
            </div>
        </div>
    );
}
