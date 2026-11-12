import { cn } from "@/lib/utils";

/** The one error banner: announced to screen readers, coloured from the --destructive token. */
export default function ErrorBanner({ id, className, children }: { id?: string; className?: string; children: React.ReactNode }) {
  return (
    <p
      id={id}
      role="alert"
      className={cn("rounded-xl border-[3px] border-destructive bg-card px-4 py-2.5 text-base font-semibold text-destructive", className)}
    >
      {children}
    </p>
  );
}
