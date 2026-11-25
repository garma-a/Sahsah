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
    // The dialog itself is a transparent scroll box no taller than the screen, so on a short (landscape) phone
    // the form scrolls and its submit button stays reachable. Its top padding leaves room for the logo.
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="session-title"
      className="m-auto max-h-dvh w-[min(92vw,30rem)] overflow-y-auto overscroll-contain bg-transparent px-0 pt-14 pb-3 text-charcoal backdrop:bg-ink/70 backdrop:backdrop-blur-[2px] short:pt-10"
    >
      {open && (
        <div className="paper relative rounded-[2rem] border-4 border-ink p-6 pt-14 shadow-[0_10px_0_var(--color-ink)] sm:p-8 sm:pt-16 short:p-5 short:pt-10">
          <Logo variant="retro" className="absolute -top-14 left-1/2 w-24 -translate-x-1/2 -rotate-6 short:-top-10 short:w-16" />
          <h2 id="session-title" className="mb-1 text-center font-heading text-4xl short:text-3xl">
            قبل ما نبدأ
          </h2>
          <p className="mb-6 text-center text-base font-medium text-ink short:mb-3">
            بنسألك مرة واحدة بس على الجهاز ده.
          </p>
          <SessionForm onDone={onDone} onCancel={onClose} />
        </div>
      )}
    </dialog>
  );
}
