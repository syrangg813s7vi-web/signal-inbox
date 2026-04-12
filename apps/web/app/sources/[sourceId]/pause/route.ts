import { NextResponse } from "next/server";

import { getMutationErrorMessage, pauseSourceFromFormData } from "@/server/source-mutations";

export async function POST(request: Request) {
  const formData = await request.formData();

  try {
    await pauseSourceFromFormData(formData);
    return redirectToSources(request, { message: "Source paused." });
  } catch (error) {
    return redirectToSources(request, { error: getMutationErrorMessage(error) });
  }
}

function redirectToSources(
  request: Request,
  params: {
    error?: string;
    message?: string;
  },
) {
  const url = new URL("/sources", request.url);

  if (params.error) {
    url.searchParams.set("error", params.error);
  }

  if (params.message) {
    url.searchParams.set("message", params.message);
  }

  return NextResponse.redirect(url, 303);
}
