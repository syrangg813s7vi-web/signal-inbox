import { NextResponse } from "next/server";

import {
  createRssSourceFromFormData,
  getMutationErrorMessage,
} from "@/server/source-mutations";

export async function POST(request: Request) {
  const formData = await request.formData();

  try {
    await createRssSourceFromFormData(formData);
    return redirectToSources(request, { message: "RSS source added." });
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
