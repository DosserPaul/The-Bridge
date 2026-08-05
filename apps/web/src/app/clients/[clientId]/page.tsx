import { ClientDetails } from "@/components/clients/client-details";

export default async function ClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return <ClientDetails clientId={clientId} />;
}
