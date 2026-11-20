import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import InfoShell from "@/components/site/info-shell";
import RichText from "@/components/site/rich-text";
import Button from "@/components/ui/button";
import StatusCard from "@/components/ui/status-card";
import { fetchPublicPage } from "@/lib/api/public";
import type { PublicPageSlug } from "@/lib/api/types";

/** One written page. Unpublished pages are a real 404; an unreachable API is said to be unreachable. */
export default async function PublicPageView({ slug }: { slug: PublicPageSlug }) {
  // Rendered per request: the page text lives in the API, which is not reachable while the site is built.
  await connection();
  const result = await fetchPublicPage(slug);
  if (result.status === "missing") notFound();
  if (result.status === "unavailable")
    return (
      <InfoShell>
        <StatusCard title="الصفحة مش متاحة دلوقتي" text="حصلت مشكلة وإحنا بنحمّل الصفحة. جرّب تاني بعد شوية.">
          <Button asChild variant="dark" size="sm">
            <Link href="/">الصفحة الرئيسية</Link>
          </Button>
        </StatusCard>
      </InfoShell>
    );
  const { page } = result;
  return (
    <InfoShell>
      <article>
        <h1 className="mb-6 font-heading text-5xl leading-tight">{page.title}</h1>
        {page.items ? (
          <div className="space-y-3">
            {page.items.map((item, index) => (
              <details key={index} className="rounded-2xl border-[3px] border-ink bg-white px-5 py-3 shadow-[0_3px_0_var(--color-ink)]">
                <summary className="cursor-pointer list-none font-heading text-2xl leading-snug">{item.question}</summary>
                <p className="mt-3 whitespace-pre-line text-lg font-medium leading-loose">{item.answer}</p>
              </details>
            ))}
          </div>
        ) : (
          <RichText text={page.body ?? ""} />
        )}
      </article>
    </InfoShell>
  );
}
