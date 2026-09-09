import { customAlphabet } from "nanoid";

// Human-friendly: no ambiguous chars (0/O, 1/l/I).
const idAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const passAlphabet =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

const idNanoid = customAlphabet(idAlphabet, 5);
const passNanoid = customAlphabet(passAlphabet, 10);

/** Build a login id from the investor's name plus a short random suffix. */
export function makeUsername(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 10) || "investor";
  return `${base}.${idNanoid().toLowerCase()}`;
}

export function makePassword(): string {
  return passNanoid();
}
