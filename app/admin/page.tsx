"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/appointments");
  }, [router]);

  return (
    <main className="p-6 flex items-center justify-center min-h-screen">
      <div className="animate-pulse">Reindirizzamento...</div>
    </main>
  );
}
