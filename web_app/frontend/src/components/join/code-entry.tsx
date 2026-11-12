"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import JoinShell from "@/components/join/join-shell";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { toLatinDigits } from "@/lib/format";

/** Players without the link type the six-digit room code here. */
export default function CodeEntry() {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const code = toLatinDigits(value).replace(/\s/g, "");
    if (!/^[0-9]{6}$/.test(code)) {
      setError("الكود ٦ أرقام. اتأكد منه مع المضيف.");
      return;
    }
    router.push(`/join/${code}`);
  }

  return (
    <JoinShell>
      <form onSubmit={submit} noValidate className="space-y-5">
        <h1 className="text-center font-heading text-4xl">ادخل كود الغرفة</h1>
        <div className="space-y-2">
          <label htmlFor={id} className="block text-base font-semibold">
            الكود اللي ظاهر على شاشة المضيف
          </label>
          <Input
            id={id}
            inputMode="numeric"
            autoComplete="off"
            maxLength={12}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError(null);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className="h-16 text-center font-heading text-4xl tracking-[0.3em]"
            placeholder="٠٠٠٠٠٠"
          />
          {error && (
            <p id={`${id}-error`} role="alert" className="font-semibold text-[#8c1c15]">
              {error}
            </p>
          )}
        </div>
        <Button type="submit" size="lg" className="w-full">
          كمّل
        </Button>
      </form>
    </JoinShell>
  );
}
