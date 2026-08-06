import type { Metadata } from "next";
import { AddRepositoryForm } from "@/components/projects/add-repository-form";

export const metadata: Metadata = { title: "Ajouter un repository" };

export default async function AddRepositoryPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <AddRepositoryForm projectId={projectId} />;
}
