"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, type FormEvent } from "react";
import Cover from "@/components/brand/cover";
import Logo from "@/components/brand/logo";
import { toneAt } from "@/components/brand/tones";
import SessionForm from "@/components/setup/session-form";
import Button from "@/components/ui/button";
import ErrorBanner from "@/components/ui/error-banner";
import Input from "@/components/ui/input";
import StatusCard from "@/components/ui/status-card";
import { ApiError } from "@/lib/api/client";
import { createRoom, firstFreshPack } from "@/lib/api/endpoints";
import { messageOf, requireField } from "@/lib/api/errors";
import { isIdentityRejected } from "@/lib/api/problems";
import type { Selection } from "@/lib/api/types";
import { formatDigits } from "@/lib/format";
import { newOperationId, newSecret } from "@/lib/ids";
import { useCategories } from "@/lib/use-categories";
import { useDraft, useDraftApi, useIdentity, useIdentityApi } from "@/providers/game-store-provider";
import { BOARD_SIZE } from "@/stores/draft-store";

type Problem =
  | { kind: "message"; text: string }
  | { kind: "open-room"; roomId: string }
  | { kind: "no-pack"; categoryIds: string[] };

export default function TeamSetup() {
  const router = useRouter();
  const identity = useIdentityApi();
  const draft = useDraftApi();
  const { state } = useCategories();
  const identityReady = useIdentity((s) => s.hydrated);
  const draftReady = useDraft((s) => s.hydrated);
  const hydrated = identityReady && draftReady;
  const host = useIdentity((s) => s.host);
  const selected = useDraft((s) => s.selected);
  const teamNames = useDraft((s) => s.teamNames);
  const ids = { one: useId(), two: useId() };
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  const byId = useMemo(
    () => new Map((state.status === "ready" ? state.categories : []).map((c, i) => [c.id, { category: c, index: i }])),
    [state],
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    const names: [string, string] = [teamNames[0].trim(), teamNames[1].trim()];
    if (!names[0] || !names[1]) {
      setProblem({ kind: "message", text: "اكتب اسم لكل فريق." });
      return;
    }
    if (names[0] === names[1]) {
      setProblem({ kind: "message", text: "الفريقين لازم يكون ليهم اسمين مختلفين." });
      return;
    }
    const current = identity.getState().host;
    if (!current) return;
    const auth = { kind: "account" as const, credential: current.credential };
    setBusy(true);
    setProblem(null);
    try {
      // The host only picks categories: each one plays its first pack this host has not played before.
      const packs = await Promise.all(selected.map((categoryId) => firstFreshPack(categoryId, auth)));
      const missing = selected.filter((_, i) => !packs[i]);
      if (missing.length) {
        setProblem({ kind: "no-pack", categoryIds: missing });
        return;
      }
      const selections: Omit<Selection, "repeatConsentBasis">[] = selected.map((categoryId, i) => ({
        boardPosition: i + 1,
        categoryId,
        packId: packs[i]!.id,
        observedRevision: packs[i]!.contentRevision,
      }));
      // Save the intent (key and secret) before sending, so a refresh retries exactly the same creation.
      const signature = JSON.stringify([names, selections.map((s) => [s.packId, s.observedRevision])]);
      let pending = draft.getState().pendingCreate;
      if (!pending || pending.signature !== signature) {
        pending = { operationId: newOperationId(), controlSecret: newSecret(), signature };
        draft.getState().setPendingCreate(pending);
      }
      const receipt = await createRoom(auth, pending.operationId, {
        teamOneName: names[0],
        teamTwoName: names[1],
        hostTeamNumber: null,
        selections,
        proposedControlSecret: pending.controlSecret,
      });
      identity.getState().setHostRoom(receipt.roomId, {
        controlSecret: pending.controlSecret,
        generation: requireField(receipt.controllerGeneration),
      });
      draft.getState().clear();
      router.replace(`/room/${receipt.roomId}`);
    } catch (cause) {
      if (cause instanceof ApiError) {
        if (isIdentityRejected(cause.code) && cause.status === 401) identity.getState().setHost(null);
        else if (cause.code === "ROOM_ALREADY_OPEN" && cause.body?.existingRoomId)
          setProblem({ kind: "open-room", roomId: cause.body.existingRoomId });
        else setProblem({ kind: "message", text: cause.message });
      } else setProblem({ kind: "message", text: messageOf(cause) });
    } finally {
      setBusy(false);
    }
  }

  function dropMissing(categoryIds: string[]) {
    for (const id of categoryIds) draft.getState().removeCategory(id);
    router.push("/");
  }

  if (!hydrated) return <Shell><p role="status" className="py-24 text-center font-heading text-3xl">ثانية…</p></Shell>;

  if (selected.length !== BOARD_SIZE) {
    return (
      <Shell>
        <StatusCard title={`لسه محتاج ${formatDigits(BOARD_SIZE)} فئات`} text={`إنت مختار ${formatDigits(selected.length)}. ارجع واختار الباقي.`}>
          <Button asChild>
            <Link href="/">اختار الفئات</Link>
          </Button>
        </StatusCard>
      </Shell>
    );
  }

  if (!host) {
    return (
      <Shell>
        <div className="mx-auto max-w-md rounded-[2rem] border-4 border-ink bg-white p-6 shadow-[0_8px_0_var(--color-ink)] sm:p-8">
          <h1 className="mb-1 text-center font-heading text-4xl">قبل ما نبدأ</h1>
          <p className="mb-6 text-center font-medium">الجلسة خلصت. ادخل الكود السري واسمك تاني.</p>
          <SessionForm onDone={() => undefined} defaultName="" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <form onSubmit={submit} className="space-y-10" noValidate>
        <div>
          <h1 className="font-heading text-5xl leading-tight sm:text-6xl">سمّوا الفريقين</h1>
          <p className="mt-2 text-lg font-medium text-ink">أهلًا {host.displayName}. الغرفة بتتفتح بعد الخطوة دي.</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {([0, 1] as const).map((index) => (
            <div
              key={index}
              className={`rounded-[1.75rem] border-4 border-ink p-5 shadow-[0_7px_0_var(--color-ink)] ${index === 0 ? "bg-cyan" : "bg-sun"}`}
            >
              <label htmlFor={index === 0 ? ids.one : ids.two} className="mb-3 block font-heading text-3xl">
                {index === 0 ? "الفريق الأول" : "الفريق التاني"}
              </label>
              <Input
                id={index === 0 ? ids.one : ids.two}
                value={teamNames[index]}
                maxLength={60}
                onChange={(event) => draft.getState().setTeamName(index, event.target.value)}
                autoComplete="off"
              />
            </div>
          ))}
        </div>

        <section aria-labelledby="picked">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 id="picked" className="font-heading text-3xl">
              فئات اللعبة
            </h2>
            <Button asChild variant="outline" size="sm">
              <Link href="/">غيّر الفئات</Link>
            </Button>
          </div>
          <ol className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-6">
            {selected.map((id, i) => {
              const entry = byId.get(id);
              const tone = toneAt(entry?.index ?? i);
              return (
                <li key={id} className="min-w-0">
                  <div className={`border-4 bg-[#fff8ea] shadow-poster ${tone.border}`}>
                    <Cover src={entry?.category.coverUrl} name={entry?.category.name ?? "فئة"} sizes="(min-width: 640px) 12vw, 30vw" />
                  </div>
                  <p className="mt-2 truncate text-center font-heading text-lg">{entry?.category.name ?? "فئة"}</p>
                </li>
              );
            })}
          </ol>
        </section>

        {problem && <ProblemNotice problem={problem} byId={byId} onDropMissing={dropMissing} />}

        <div className="flex flex-wrap items-center gap-4 pb-10">
          <Button type="submit" size="xl" disabled={busy}>
            {busy ? "بنجهّز الغرفة…" : "افتح الغرفة"}
          </Button>
        </div>
      </form>
    </Shell>
  );
}

function ProblemNotice({
  problem,
  byId,
  onDropMissing,
}: {
  problem: Problem;
  byId: Map<string, { category: { name: string } }>;
  onDropMissing: (ids: string[]) => void;
}) {
  if (problem.kind === "open-room") {
    return (
      <div role="alert" className="rounded-2xl border-[3px] border-ink bg-sun p-5 shadow-[0_5px_0_var(--color-ink)]">
        <p className="font-heading text-2xl">عندك غرفة مفتوحة بالفعل</p>
        <p className="mt-1 font-medium">كمّل فيها، أو اقفلها من جوّه وابدأ غرفة جديدة.</p>
        <Button asChild variant="dark" size="sm" className="mt-3">
          <Link href={`/room/${problem.roomId}`}>افتح غرفتك</Link>
        </Button>
      </div>
    );
  }
  if (problem.kind === "no-pack") {
    const names = problem.categoryIds.map((id) => byId.get(id)?.category.name ?? "فئة");
    return (
      <div role="alert" className="rounded-2xl border-[3px] border-ink bg-sun p-5 shadow-[0_5px_0_var(--color-ink)]">
        <p className="font-heading text-2xl">مفيش أسئلة جديدة في: {names.join("، ")}</p>
        <p className="mt-1 font-medium">إنت لعبت كل الأسئلة المتاحة فيها. اختار فئة تانية بداله.</p>
        <Button variant="dark" size="sm" className="mt-3" onClick={() => onDropMissing(problem.categoryIds)}>
          اختار فئة تانية
        </Button>
      </div>
    );
  }
  return <ErrorBanner>{problem.text}</ErrorBanner>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="paper min-h-dvh">
      <div className="mx-auto max-w-[1000px] px-5 pb-10 pt-6 sm:px-8">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" aria-label="صحصح، الصفحة الرئيسية">
            <Logo variant="retro" className="w-14" />
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link href="/">رجوع للفئات</Link>
          </Button>
        </div>
        <main>{children}</main>
      </div>
    </div>
  );
}
