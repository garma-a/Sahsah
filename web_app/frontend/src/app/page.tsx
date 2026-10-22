import GameSetup from "@/components/game-setup";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-8 px-6 py-12">
      <header className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Sahsah · Web starter</p>
        <h1 className="text-5xl font-bold tracking-tight">صحصح</h1>
        <p className="text-muted-foreground">جهّزوا الفريقين، واللعبة جاية قريب.</p>
      </header>
      <GameSetup />
    </main>
  );
}
