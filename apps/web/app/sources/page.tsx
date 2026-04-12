import { SourcesPage } from "@/components/sources-page";
import { getSourcesPageViewModel } from "@/server/sources";

interface SourcesRouteParams {
  error?: string | string[];
  message?: string | string[];
}

function readSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default async function SourcesRoute({
  searchParams,
}: {
  searchParams?: Promise<SourcesRouteParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const viewModel = await getSourcesPageViewModel();

  return (
    <SourcesPage
      errorMessage={readSearchParam(resolvedSearchParams.error)}
      noticeMessage={readSearchParam(resolvedSearchParams.message)}
      viewModel={viewModel}
    />
  );
}
