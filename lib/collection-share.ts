import { createHmac } from "crypto";

const encodeBase64Url = (value: string) =>
  Buffer.from(value).toString("base64url");

const decodeBase64Url = (value: string) =>
  Buffer.from(value, "base64url").toString("utf8");

const getSecret = () => {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required for share tokens");
  }
  return secret;
};

export const createCollectionShareToken = (collectionId: number) => {
  const secret = getSecret();
  const payload = String(collectionId);
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return `${encodeBase64Url(payload)}.${signature}`;
};

export const parseCollectionShareToken = (token: string) => {
  const secret = getSecret();
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;
  const payload = decodeBase64Url(encodedPayload);
  if (!/^\d+$/.test(payload)) return null;
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  if (expected !== signature) return null;
  return Number.parseInt(payload, 10);
};
