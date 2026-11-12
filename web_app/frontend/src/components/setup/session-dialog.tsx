"use client";

import { useEffect, useRef } from "react";
import Logo from "@/components/brand/logo";
import SessionForm from "@/components/setup/session-form";

type SessionDialogProps = { open: boolean; onClose: () => void; onDone: () => void };

/** The passcode and name step as a native modal dialog: focus trap and Esc come from the platform. */
export default function SessionDialog({ open, onClose, onDone }: SessionDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="session-title"
      className="m-auto w-[min(92vw,30rem)] overflow-visible rounded-[2rem] border-4 border-ink bg-transparent p-0 text-charcoal backdrop:bg-ink/70 backdrop:backdrop-blur-[2px]"
    >
      {open && (
        <div className="paper relative rounded-[1.7rem] p-6 pt-14 shadow-[0_10px_0_var(--color-ink)] sm:p-8 sm:pt-16">
          <Logo variant="retro" className="absolute -top-14 left-1/2 w-24 -translate-x-1/2 -rotate-6" />
          <h2 id="session-title" className="mb-1 text-center font-heading text-4xl">
            قبل ما نبدأ
          </h2>
          <p className="mb-6 text-center text-base font-medium text-charcoal/80">
            بنسألك مرة واحدة بس على الجهاز ده.
          </p>
          <SessionForm onDone={onDone} onCancel={onClose} />
        </div>
      )}
    </dialog>
  );
}
