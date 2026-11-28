import type { Metadata } from "next";
import PublicPageView from "@/components/site/public-page-view";

export const metadata: Metadata = { title: "الشروط والأحكام | صحصح" };

export default function Page() {
  return <PublicPageView slug="terms" />;
}
