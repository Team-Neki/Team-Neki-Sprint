export function deepLink(
  base: string,
  kind: "tasks" | "wiki",
  id: string,
): string {
  return `${base.replace(/\/+$/, "")}/${kind}/${id}`;
}

interface ApiError {
  ok: false;
  error: string;
  issues?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
}

export function describeApiError(body: ApiError): string {
  const parts = [body.error];
  const fe = body.issues?.fieldErrors;
  if (fe) {
    for (const [field, msgs] of Object.entries(fe)) {
      if (msgs?.length) parts.push(`${field}: ${msgs.join(", ")}`);
    }
  }
  if (body.issues?.formErrors?.length) {
    parts.push(body.issues.formErrors.join(", "));
  }
  return parts.join(" — ");
}
