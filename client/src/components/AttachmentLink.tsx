import { useState } from "react";
import { FileText, ImageIcon, Loader2 } from "lucide-react";
import { api } from "../api";

export function AttachmentLink({
  id,
  name,
  mimeType,
}: {
  id: string;
  name: string;
  mimeType: string;
}) {
  const [busy, setBusy] = useState(false);
  const isImage = mimeType.startsWith("image/");

  async function open() {
    setBusy(true);
    try {
      const r = await api.get(`/files/${id}`, { responseType: "blob" });
      const url = URL.createObjectURL(r.data);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={open}
      disabled={busy}
      className="inline-flex max-w-[200px] items-center gap-1.5 rounded-md border border-graphite-200 bg-graphite-50 px-2 py-1 text-xs text-graphite-600 hover:bg-graphite-100"
      title={name}
    >
      {busy ? (
        <Loader2 size={13} className="animate-spin" />
      ) : isImage ? (
        <ImageIcon size={13} />
      ) : (
        <FileText size={13} />
      )}
      <span className="truncate">{name}</span>
    </button>
  );
}
