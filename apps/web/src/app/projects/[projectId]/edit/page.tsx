import type { Metadata } from "next";
import { EditProjectForm } from "@/components/projects/edit-project-form";

export const metadata: Metadata = { title: "Modifier le projet" };

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <EditProjectForm projectId={projectId} />;
}
