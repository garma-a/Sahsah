import { Smartphone } from "lucide-react";

/**
 * The game is played sideways: on a phone or tablet held upright this covers the screen and asks the player
 * to turn the device. Pure CSS (see the `portrait-touch` variant), so it follows the device without script.
 */
export default function RotateNotice() {
  return (
    <div
      role="alert"
      className="fixed inset-0 z-[100] hidden flex-col items-center justify-center gap-6 bg-night px-8 text-center text-cream portrait-touch:flex"
    >
      <Smartphone aria-hidden className="size-20 animate-[turn_2.4s_ease-in-out_infinite] text-sun" strokeWidth={1.75} />
      <p className="font-heading text-3xl leading-snug">لفّ الموبايل بالعرض</p>
      <p className="max-w-xs text-lg font-medium text-cream/80">صحصح بيتلعب والشاشة بالعرض، عشان كل حاجة تبان قدامك من غير ما تنزل لتحت.</p>
    </div>
  );
}
