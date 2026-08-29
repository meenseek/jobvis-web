import { normalizeApplicationFilter } from "@/src/applications/application-data";
import ApplicationsClientPage from "@/src/applications/applications-client-page";

type ApplicationsPageProps = {
  searchParams?: Promise<{
    q?: string | string[];
    status?: string | string[];
  }>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ApplicationsPage({
  searchParams,
}: ApplicationsPageProps) {
  const params = await searchParams;
  const initialQuery = firstValue(params?.q) ?? "";
  const initialFilter = normalizeApplicationFilter(
    firstValue(params?.status) ?? null,
  );

  return (
    <ApplicationsClientPage
      initialQuery={initialQuery}
      initialFilter={initialFilter}
    />
  );
}
