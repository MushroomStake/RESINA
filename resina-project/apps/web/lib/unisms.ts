type UnismsSendOptions = {
  phoneNumber: string;
  message: string;
};

type UnismsBlastOptions = {
  phoneNumbers: string[];
  message: string;
  metadata?: Record<string, unknown>;
};

type UnismsMessage = {
  status: string;
  reference_id?: string;
  [key: string]: unknown;
};

type UnismsResponse = {
  message?: UnismsMessage;
  [key: string]: unknown;
};

function resolveUnismsKey(): string {
  const apiKey = process.env.UNISMS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("UNISMS_API_KEY is not configured.");
  }

  return apiKey;
}

export function isUnismsDisabled(): boolean {
  return process.env.UNISMS_SMS_DISABLED?.toLowerCase() === "true";
}

function buildBasicAuthHeader(): string {
  const apiKey = resolveUnismsKey();
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

export async function sendUnismsSms(options: UnismsSendOptions): Promise<{ messageId: string | null }> {
  // UniSMS uses Basic Auth (API key as username, empty password)
  const authHeader = buildBasicAuthHeader();
  const senderNameEnv = process.env.UNISMS_SENDER_NAME?.trim() ?? "";
  const useProviderSender = (process.env.UNISMS_USE_PROVIDER_SENDER ?? "").toLowerCase() === "true";
  const body: Record<string, unknown> = {
    recipient: options.phoneNumber,
    content: options.message,
  };
  if (!useProviderSender && senderNameEnv) {
    body.sender_id = senderNameEnv;
  }

  try {
    console.debug("[unisms] sendUnismsSms request", body);
  } catch (e) {
    // ignore logging errors
  }

  const response = await fetch("https://unismsapi.com/api/sms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  let parsed: UnismsResponse | string = raw;
  try {
    parsed = JSON.parse(raw) as UnismsResponse;
  } catch (e) {
    // keep raw text
  }

  try {
    console.debug("[unisms] sendUnismsSms response", response.status, parsed);
  } catch (e) {
    // ignore
  }

  if (!response.ok) {
    const errorText = typeof parsed === "string" ? parsed : JSON.stringify(parsed);
    throw new Error(`UniSMS request failed (${response.status}): ${errorText}`);
  }

  const referenceId = typeof parsed === "object" ? (parsed.message?.reference_id ?? null) : null;
  return { messageId: typeof referenceId === "string" ? referenceId : null };
}

export async function sendUnismsBlast(options: UnismsBlastOptions): Promise<{ blastId: string | null }> {
  const senderNameEnv = process.env.UNISMS_SENDER_NAME?.trim() ?? "";
  const useProviderSender = (process.env.UNISMS_USE_PROVIDER_SENDER ?? "").toLowerCase() === "true";
  const body: Record<string, unknown> = {
    recipients: options.phoneNumbers,
    content: options.message,
  };
  if (!useProviderSender && senderNameEnv) {
    body.sender_id = senderNameEnv;
  }

  if (options.metadata) {
    body.metadata = options.metadata;
  }

  try {
    console.debug("[unisms] sendUnismsBlast request", body);
  } catch (e) {
    // ignore
  }

  const response = await fetch("https://unismsapi.com/api/blast", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: buildBasicAuthHeader(),
    },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  let parsed: any = raw;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    // keep raw
  }

  try {
    console.debug("[unisms] sendUnismsBlast response", response.status, parsed);
  } catch (e) {
    // ignore
  }

  if (!response.ok) {
    const errorText = typeof parsed === "string" ? parsed : JSON.stringify(parsed);
    throw new Error(`UniSMS blast failed (${response.status}): ${errorText}`);
  }

  const blastId = parsed?.blast_id ?? parsed?.message?.reference_id ?? null;
  return { blastId: typeof blastId === "string" ? blastId : null };
}