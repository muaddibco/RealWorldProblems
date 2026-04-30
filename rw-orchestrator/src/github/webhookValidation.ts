import { createHmac, timingSafeEqual } from "crypto";

interface SignatureInput {
  secret: string;
  rawBody: string;
  signature256: string | null;
}

export function verifyGitHubSignature(input: SignatureInput): void {
  if (!input.signature256) {
    throw new Error("Missing x-hub-signature-256 header");
  }

  const expected = `sha256=${createHmac("sha256", input.secret).update(input.rawBody).digest("hex")}`;
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(input.signature256, "utf8");

  if (expectedBuffer.length !== providedBuffer.length) {
    throw new Error("Invalid webhook signature length");
  }

  if (!timingSafeEqual(expectedBuffer, providedBuffer)) {
    throw new Error("Invalid webhook signature");
  }
}
