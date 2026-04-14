import { NextResponse } from "next/server";

import { SubmittedUrlValidationError } from "@signal-inbox/capture";

import { getUrlIngestErrorMessage, ingestSubmittedUrl } from "@/server/url-ingest-mutations";

export async function POST(request: Request) {
  const payload = await readJsonPayload(request);
  const submittedUrl = readSubmittedUrl(payload);

  try {
    const result = await ingestSubmittedUrl(submittedUrl);

    return NextResponse.json(
      {
        captureEntryId: result.captureEntryId,
        normalizedItemIds: result.normalizedItemIds,
        processedItemIds: result.processedItemIds,
        rawAssetIds: result.rawAssetIds,
        submittedUrl: result.submittedUrl,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    const message = getUrlIngestErrorMessage(error);

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: error instanceof SubmittedUrlValidationError ? 400 : 500,
      },
    );
  }
}

async function readJsonPayload(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function readSubmittedUrl(payload: unknown): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "";
  }

  const submittedUrl = (payload as { url?: unknown }).url;
  return typeof submittedUrl === "string" ? submittedUrl : "";
}
