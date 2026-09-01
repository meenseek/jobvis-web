import { Suspense } from "react";
import { OAuthCallbackClient } from "@/src/settings/oauth-callback-client";

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <OAuthCallbackClient />
    </Suspense>
  );
}
