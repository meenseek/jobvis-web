const PLATFORM_USER_ID_HEADER = "oai-authenticated-user-id";
const API_USER_ID_HEADER = "x-jobvis-site-user-id";
const API_SECRET_HEADER = "x-jobvis-site-gateway-secret";
const MINIMUM_SECRET_BYTES = 32;
const MAXIMUM_USER_ID_LENGTH = 512;

export class TrustedSiteIdentityRequiredError extends Error {}
export class TrustedSiteGatewayConfigurationError extends Error {}

export function usesTrustedSiteGateway() {
  return process.env.JOBVIS_API_MODE === "sites";
}

export function appendTrustedSiteGatewayHeaders(
  request: { headers: Headers },
  headers: Headers,
) {
  if (!usesTrustedSiteGateway()) return;

  const secret = process.env.JOBVIS_TRUSTED_SITE_SECRET;
  if (
    !secret ||
    new TextEncoder().encode(secret).length < MINIMUM_SECRET_BYTES
  ) {
    throw new TrustedSiteGatewayConfigurationError(
      "Sites gateway secret is not configured",
    );
  }

  const userId = request.headers.get(PLATFORM_USER_ID_HEADER)?.trim();
  if (!userId || userId.length > MAXIMUM_USER_ID_LENGTH) {
    throw new TrustedSiteIdentityRequiredError(
      "Sites authenticated user is required",
    );
  }

  headers.set(API_USER_ID_HEADER, userId);
  headers.set(API_SECRET_HEADER, secret);
}
