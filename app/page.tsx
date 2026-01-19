import { supabase } from "../lib/supabaseClient";

export default async function Home() {
  const { data, error } = await supabase
    .from("services")
    .select("name, default_price_cents")
    .order("name", { ascending: true })
    .limit(10);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Studio Fisio Ledger — Test Supabase</h1>

      {error ? (
        <pre className="mt-4 text-sm whitespace-pre-wrap">
          ERRORE: {error.message}
        </pre>
      ) : (
        <div className="mt-4">
          <div className="font-medium">Servizi (max 10):</div>
          <ul className="mt-2 list-disc pl-6">
            {(data ?? []).map((s) => (
              <li key={s.name}>
                {s.name} — €{(s.default_price_cents / 100).toFixed(2)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}

