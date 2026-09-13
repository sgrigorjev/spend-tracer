import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { Buffer } from "node:buffer";
import path from "node:path";
import type { Message } from "@telegraf/types";
import type { Context } from "telegraf";

const DOWNLOADS_DIR = "downloads";

export type AttachmentKind =
  | "photo"
  | "document"
  | "video"
  | "audio"
  | "voice"
  | "video_note"
  | "sticker"
  | "animation";

export interface AttachmentInfo {
  kind: AttachmentKind;
  fileId: string;
  name: string;
  size: number | null;
}

/** Strip characters that are invalid in file names. */
function sanitize(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_");
}

/** Format a byte count as a human-readable size, e.g. `2.4 MB`. */
function formatSize(bytes: number | null): string {
  if (bytes == null) return "";
  const mb = bytes / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  if (kb >= 1) return `${Math.round(kb)} KB`;
  return `${bytes} B`;
}

/** Extract the attachment from a message, if any. */
export function getAttachment(msg: Message): AttachmentInfo | null {
  if ("photo" in msg) {
    const photo = msg.photo[msg.photo.length - 1];
    return { kind: "photo", fileId: photo.file_id, name: `photo_${photo.file_unique_id}.jpg`, size: photo.file_size ?? null };
  }
  // Animation messages also carry a document field, so check animation first.
  if ("animation" in msg) return { kind: "animation", fileId: msg.animation.file_id, name: msg.animation.file_name ?? "animation.gif", size: msg.animation.file_size ?? null };
  if ("document" in msg) return { kind: "document", fileId: msg.document.file_id, name: msg.document.file_name ?? "document.bin", size: msg.document.file_size ?? null };
  if ("video" in msg) return { kind: "video", fileId: msg.video.file_id, name: msg.video.file_name ?? "video.mp4", size: msg.video.file_size ?? null };
  if ("audio" in msg) return { kind: "audio", fileId: msg.audio.file_id, name: msg.audio.file_name ?? "audio", size: msg.audio.file_size ?? null };
  if ("voice" in msg) return { kind: "voice", fileId: msg.voice.file_id, name: `voice_${msg.voice.file_unique_id}.ogg`, size: msg.voice.file_size ?? null };
  if ("video_note" in msg) return { kind: "video_note", fileId: msg.video_note.file_id, name: `video_note_${msg.video_note.file_unique_id}.mp4`, size: msg.video_note.file_size ?? null };
  if ("sticker" in msg) return { kind: "sticker", fileId: msg.sticker.file_id, name: `sticker_${msg.sticker.file_unique_id}.webp`, size: msg.sticker.file_size ?? null };
  return null;
}

/** Format a Unix timestamp for use in file names: `YYYY-MM-DD-HH-MM-SS`. */
function formatTimestamp(sec: number): string {
  const d = new Date(sec * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

/** Download an attachment from Telegram into the downloads directory. */
export async function downloadAttachment(ctx: Context, attachment: AttachmentInfo): Promise<string> {
  const name = sanitize(attachment.name || attachment.kind);
  const filePath = path.join(DOWNLOADS_DIR, `${formatTimestamp(ctx.message!.date)}-${name}`);
  // Skip re-downloading if the file already exists (same timestamp + name).
  if (existsSync(filePath)) return filePath;

  const url = await ctx.telegram.getFileLink(attachment.fileId);
  const res = await fetch(url.href);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  await mkdir(DOWNLOADS_DIR, { recursive: true });
  await writeFile(filePath, Buffer.from(await res.arrayBuffer()));
  return filePath;
}

/** Build a short textual summary of an attachment, e.g. `[photo] name (2.4 MB)`. */
export function describeAttachment(attachment: AttachmentInfo): string {
  const size = formatSize(attachment.size);
  return `[${attachment.kind}]${attachment.name ? ` ${attachment.name}` : ""}${size ? ` (${size})` : ""}`;
}
