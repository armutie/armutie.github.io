const AUTH_ERROR_KEYS = ["error", "error_code", "error_description"] as const;

function authParams(url: URL) {
  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  const hashParams = new URLSearchParams(hash);
  return {
    get(key: string) {
      return url.searchParams.get(key) ?? hashParams.get(key);
    },
    hashParams,
  };
}

export function getAuthRedirectUrl(
  origin = window.location.origin,
  baseUrl = import.meta.env.BASE_URL,
) {
  return new URL(baseUrl, `${origin}/`).toString();
}

export function getOAuthRedirectError(urlValue: string) {
  const url = new URL(urlValue);
  const params = authParams(url);
  const error = params.get("error");
  const code = params.get("error_code");

  if (!error && !code) return null;

  if (error === "access_denied" || code === "access_denied") {
    return "Google sign-in was cancelled. You can try again or use email instead.";
  }

  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit") {
    return "Too many sign-in attempts were made. Wait a few minutes, then try again.";
  }

  if (code === "provider_disabled" || code === "oauth_provider_not_supported") {
    return "Google sign-in is not available right now. Use email instead.";
  }

  return "Google sign-in could not be completed. Try again or use email instead.";
}

export function clearOAuthRedirectError() {
  const url = new URL(window.location.href);
  const { hashParams } = authParams(url);
  const hasHashError = AUTH_ERROR_KEYS.some((key) => hashParams.has(key));
  const hasQueryError = AUTH_ERROR_KEYS.some((key) => url.searchParams.has(key));

  if (!hasHashError && !hasQueryError) return;

  AUTH_ERROR_KEYS.forEach((key) => url.searchParams.delete(key));
  if (hasHashError) url.hash = "";
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}
