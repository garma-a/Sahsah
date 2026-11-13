"use client";

import { Eye, EyeOff, Lightbulb, MonitorUp, Pause, Play, RotateCcw, Undo2 } from "lucide-react";
import type { ComponentType } from "react";
import Button from "@/components/ui/button";
import type { CommandName } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/** Commands that act on the open question and need nothing but its position. */
export type QuestionAction =
  | "return_to_board"
  | "advance_hint"
  | "show_memory"
  | "hide_memory"
  | "pause_timer"
  | "resume_timer"
  | "reset_timer"
  | "reveal_answer";

const actions: { name: QuestionAction; label: string; busy: string; icon: ComponentType<{ className?: string }> }[] = [
  { name: "reveal_answer", label: "اكشف الإجابة", busy: "بنكشف…", icon: MonitorUp },
  { name: "advance_hint", label: "تلميح تاني", busy: "ثانية…", icon: Lightbulb },
  { name: "show_memory", label: "اعرض الصورة", busy: "ثانية…", icon: Eye },
  { name: "hide_memory", label: "اخفي الصورة", busy: "ثانية…", icon: EyeOff },
  { name: "pause_timer", label: "وقّف الوقت", busy: "ثانية…", icon: Pause },
  { name: "resume_timer", label: "كمّل الوقت", busy: "ثانية…", icon: Play },
  { name: "reset_timer", label: "الوقت من الأول", busy: "ثانية…", icon: RotateCcw },
  { name: "return_to_board", label: "ارجع للوحة", busy: "ثانية…", icon: Undo2 },
];

type HostBarProps = {
  controls: CommandName[];
  /** The command in flight, if any. */
  pending: string | null;
  onAct: (name: QuestionAction) => void;
};

/**
 * The host's controls, together in one dark bar apart from what the audience reads. Only the commands the
 * server lists in `controls` for this exact moment are shown, so a button never offers an illegal step.
 */
export default function HostBar({ controls, pending, onAct }: HostBarProps) {
  const available = actions.filter((action) => controls.includes(action.name));
  return (
    <div
      role="group"
      aria-label="تحكم المضيف"
      className="flex flex-wrap items-center gap-3 rounded-[1.4rem] border-4 border-ink bg-ink p-3 text-cream shadow-[0_8px_0_var(--color-night)] sm:px-4"
    >
      <p className="me-auto flex items-center gap-2 font-heading text-lg leading-none text-cream/75">
        <MonitorUp aria-hidden className="size-5" strokeWidth={2.5} />
        تحكم المضيف
      </p>
      {available.map((action) => {
        const Icon = action.icon;
        const primary = action.name === "reveal_answer";
        const quiet = action.name === "return_to_board";
        return (
          <Button
            key={action.name}
            size={primary ? "lg" : "default"}
            variant={primary ? "default" : quiet ? "ghost" : "outline"}
            disabled={pending !== null}
            aria-busy={pending === action.name || undefined}
            onClick={() => onAct(action.name)}
            className={cn(quiet && "text-cream hover:bg-cream/15")}
          >
            <Icon aria-hidden className="size-5" />
            {pending === action.name ? action.busy : action.label}
          </Button>
        );
      })}
    </div>
  );
}
