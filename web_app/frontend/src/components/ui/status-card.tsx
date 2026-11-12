import { cn } from "@/lib/utils";

type StatusCardProps = {
  title: string;
  text?: string;
  /** Announce the card politely, for "loading" states. */
  busy?: boolean;
  className?: string;
  children?: React.ReactNode;
};

/** One centred paper card for loading, notice and dead-end states. Children are its actions. */
export default function StatusCard({ title, text, busy, className, children }: StatusCardProps) {
  return (
    <div
      role={busy ? "status" : undefined}
      className={cn(
        "paper-card m-auto flex w-full max-w-lg flex-col items-center gap-3 rounded-[2rem] border-4 border-ink p-8 text-center shadow-[0_10px_0_var(--color-ink)]",
        className,
      )}
    >
      <h1 className="font-heading text-4xl leading-tight">{title}</h1>
      {text && <p className="text-lg font-medium">{text}</p>}
      {children && <div className="mt-2 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}
