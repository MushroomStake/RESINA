type UnismsSendOptions = {
  phoneNumber: string;
  message: string;
};

type UnismsBlastOptions = {
  phoneNumbers: string[];
  message: string;
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

  const response = await fetch("https://unismsapi.com/api/sms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      recipient: options.phoneNumber,
      content: options.message,
      sender_id: process.env.UNISMS_SENDER_NAME ?? "RESINA",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`UniSMS request failed (${response.status}): ${errorText}`);
  }

  const payload = (await response.json()) as UnismsResponse;
  const referenceId = payload.message?.reference_id ?? null;

  return { messageId: typeof referenceId === "string" ? referenceId : null };
}

export async function sendUnismsBlast(options: UnismsBlastOptions): Promise<{ blastId: string | null }> {
  const response = await fetch("https://unismsapi.com/api/blast", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: buildBasicAuthHeader(),
    },
    body: JSON.stringify({
      recipients: options.phoneNumbers,
      content: options.message,
      sender_id: process.env.UNISMS_SENDER_NAME ?? "RESINA",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`UniSMS blast failed (${response.status}): ${errorText}`);
  }

  const payload = (await response.json()) as { blast_id?: string };
  const blastId = payload.blast_id ?? null;

  return { blastId: typeof blastId === "string" ? blastId : null };
}