import type { Metadata } from "next";
import ContactForm from "@/components/site/contact-form";
import InfoShell from "@/components/site/info-shell";

export const metadata: Metadata = { title: "تواصل معانا | صحصح" };

export default function ContactPage() {
  return (
    <InfoShell>
      <ContactForm />
    </InfoShell>
  );
}
