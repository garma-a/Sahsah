"use client";

import { useState } from "react";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { getHealth } from "@/lib/api";
import { useGameStore } from "@/providers/game-store-provider";

export default function GameSetup() {
  const teams = useGameStore((state) => state.teams);
  const setTeamName = useGameStore((state) => state.setTeamName);
  const reset = useGameStore((state) => state.reset);
  const [status, setStatus] = useState("لم يتم فحص الاتصال بعد");
  const [checking, setChecking] = useState(false);

  async function checkBackend() {
    setChecking(true);
    try {
      const health = await getHealth();
      setStatus(health.status === "ok" ? "الخادم متصل" : "الخادم غير جاهز");
    } catch {
      setStatus("تعذّر الاتصال بالخادم");
    } finally {
      setChecking(false);
    }
  }

  return (
    <section aria-labelledby="teams-heading" className="space-y-6 rounded-xl border bg-card p-6 shadow-sm">
      <h2 id="teams-heading" className="text-xl font-semibold">الفريقين</h2>
      {([0, 1] as const).map((index) => (
        <div key={index} className="space-y-2">
          <label htmlFor={`team-${index}`} className="text-sm font-medium">{index === 0 ? "الفريق الأول" : "الفريق الثاني"}</label>
          <Input id={`team-${index}`} value={teams[index]} maxLength={50} onChange={(event) => setTeamName(index, event.target.value)} />
        </div>
      ))}
      <p className="text-sm text-muted-foreground">{teams[0] || "الفريق الأول"} × {teams[1] || "الفريق الثاني"}</p>
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={checkBackend} disabled={checking}>{checking ? "جاري الفحص…" : "فحص اتصال الخادم"}</Button>
        <Button type="button" variant="outline" onClick={reset}>إعادة الأسماء</Button>
      </div>
      <p role="status" className="text-sm text-muted-foreground">{status}</p>
    </section>
  );
}
