import type { Metadata } from "next";
import { IntegrationsSettings } from "@/components/integrations/integrations-settings";

export const metadata: Metadata = {
  title: "Intégrations",
};

export default function IntegrationsPage() {
  return <IntegrationsSettings />;
}
