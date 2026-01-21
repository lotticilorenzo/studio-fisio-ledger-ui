export function eur(cents: number) {
    return `€${((cents ?? 0) / 100).toFixed(2)}`;
}
