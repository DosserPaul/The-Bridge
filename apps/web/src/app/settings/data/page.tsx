import type { Metadata } from "next";
import { DataSettings } from "@/components/data/data-settings";

export const metadata: Metadata = {
  title: "Données & sauvegardes",
};

export default function DataSettingsPage() {
  return <DataSettings />;
}
