import { NextResponse } from "next/server";

import { SubmittedUrlValidationError } from "@signal-inbox/capture";

import {
  getUrlIngestErrorMessage,
  ingestSubmittedUrlWithOptions,
} from "@/server/url-ingest-mutations";

export async function GET(request: Request) {
  const submittedUrl = new URL(request.url).searchParams.get("url") ?? "";

  try {
    const result = await ingestSubmittedUrlWithOptions(submittedUrl, {
      triggerRef: "web:url-ingest-debug-get",
    });

    return NextResponse.json(
      {
        captureEntryId: result.captureEntryId,
        manualTestOnly: true,
        message: "Debug URL ingest succeeded. This GET route is for manual/browser testing only.",
        normalizedItemIds: result.normalizedItemIds,
        ok: true,
        processedItemIds: result.processedItemIds,
        rawAssetIds: result.rawAssetIds,
        submittedUrl: result.submittedUrl,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    const message = getUrlIngestErrorMessage(error);

    return NextResponse.json(
      {
        error: message,
        manualTestOnly: true,
        message: "Debug URL ingest failed. This GET route is for manual/browser testing only.",
        ok: false,
        submittedUrl: submittedUrl.trim() || null,
      },
      {
        status: error instanceof SubmittedUrlValidationError ? 400 : 500,
      },
    );
  }
}
