import type { Metadata } from "next";
import PublicPageView from "@/components/site/public-page-view";

export const metadata: Metadata = { title: "سياسة الخصوصية | صحصح" };

export default function Page() {
  return <PublicPageView slug="privacy" />;
}
