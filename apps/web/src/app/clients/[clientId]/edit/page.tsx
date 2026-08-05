import { EditClientForm } from "@/components/clients/edit-client-form";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return <EditClientForm clientId={clientId} />;
}
