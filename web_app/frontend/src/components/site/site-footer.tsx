"use client";

import Image from "next/image";
import Link from "next/link";
import Logo from "@/components/brand/logo";
import { telLink, whatsappLink } from "@/lib/safe-link";
import { useSiteSettings } from "@/lib/use-site-settings";

const links = [
  { href: "/about", label: "عن صحصح" },
  { href: "/faq", label: "الأسئلة الشائعة" },
  { href: "/privacy", label: "الخصوصية" },
  { href: "/terms", label: "الشروط والأحكام" },
  { href: "/contact", label: "تواصل معانا" },
];

// Numbers and addresses keep their own left-to-right order inside the right-to-left line.
const ltr = "whitespace-nowrap [unicode-bidi:isolate]";
const linkClass = "rounded-md underline-offset-4 hover:text-sun hover:underline";

/** The site footer: fixed page links, plus the contact details and social addresses staff configured. */
export default function SiteFooter() {
  const settings = useSiteSettings();
  const https = (url?: string) => (url?.startsWith("https://") ? url : undefined);
  const social = [
    { label: "فيسبوك", href: https(settings?.facebookUrl) },
    { label: "إنستجرام", href: https(settings?.instagramUrl) },
    { label: "تيك توك", href: https(settings?.tiktokUrl) },
  ].filter((item): item is { label: string; href: string } => !!item.href);
  const whatsapp = settings?.whatsapp ? whatsappLink(settings.whatsapp) : null;
  const tel = settings?.supportPhone ? telLink(settings.supportPhone) : null;
  return (
    <footer className="relative z-10 bg-night text-cream">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-start justify-between gap-8 px-5 py-8 sm:px-8 lg:px-12">
        <div className="flex items-center gap-4">
          {settings?.logoUrl && settings.logoWidth && settings.logoHeight ? (
            <Image src={settings.logoUrl} width={settings.logoWidth} height={settings.logoHeight} alt="صحصح" unoptimized className="h-14 w-auto max-w-40 object-contain" />
          ) : (
            <Logo variant="mono" className="w-14 text-sun" />
          )}
          <p className="font-heading text-2xl">ذكريات .. أسئلة .. متعة</p>
        </div>
        <nav aria-label="صفحات الموقع">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-lg font-medium">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={linkClass}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {(tel || whatsapp || settings?.supportEmail || social.length > 0) && (
          <ul className="flex w-full flex-wrap gap-x-6 gap-y-2 border-t border-cream/20 pt-5 text-base font-medium" aria-label="طرق التواصل">
            {tel && settings?.supportPhone && (
              <li>
                <a href={tel} className={linkClass}>
                  <bdi dir="ltr" className={ltr}>
                    {settings.supportPhone}
                  </bdi>
                </a>
              </li>
            )}
            {whatsapp && (
              <li>
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  واتساب
                </a>
              </li>
            )}
            {settings?.supportEmail && (
              <li>
                <a href={`mailto:${settings.supportEmail}`} className={linkClass}>
                  <bdi dir="ltr" className={ltr}>
                    {settings.supportEmail}
                  </bdi>
                </a>
              </li>
            )}
            {social.map((item) => (
              <li key={item.label}>
                <a href={item.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </footer>
  );
}
