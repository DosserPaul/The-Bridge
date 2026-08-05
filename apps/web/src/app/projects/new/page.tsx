import { NewProjectForm } from "@/components/projects/new-project-form";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string | string[] }>;
}) {
  const clientId = (await searchParams).clientId;
  return (
    <NewProjectForm
      initialClientId={typeof clientId === "string" ? clientId : undefined}
    />
  );
}
