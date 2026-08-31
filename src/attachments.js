import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { Buffer } from "node:buffer";
import path from "node:path";

const DOWNLOADS_DIR = "downloads";

/** Strip characters that are invalid in file names. */
function sanitize(name) {
  return name.replace(/[\\/:*?"<>|]/g, "_");
}

/** Format a byte count as a human-readable size, e.g. `2.4 MB`. */
function formatSize(bytes) {
  if (bytes == null) return "";
  const mb = bytes / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  if (kb >= 1) return `${Math.round(kb)} KB`;
  return `${bytes} B`;
}

/** Extract the attachment from a message, if any. */
function getAttachment(msg) {
  if (msg.photo) {
    const photo = msg.photo[msg.photo.length - 1];
    return { kind: "photo", fileId: photo.file_id, name: `photo_${photo.file_unique_id}.jpg`, size: photo.file_size };
  }
  if (msg.document) return { kind: "document", fileId: msg.document.file_id, name: msg.document.file_name, size: msg.document.file_size };
  if (msg.video) return { kind: "video", fileId: msg.video.file_id, name: msg.video.file_name, size: msg.video.file_size };
  if (msg.audio) return { kind: "audio", fileId: msg.audio.file_id, name: msg.audio.file_name, size: msg.audio.file_size };
  if (msg.voice) return { kind: "voice", fileId: msg.voice.file_id, name: `voice_${msg.voice.file_unique_id}.ogg`, size: msg.voice.file_size };
  if (msg.video_note) return { kind: "video_note", fileId: msg.video_note.file_id, name: `video_note_${msg.video_note.file_unique_id}.mp4`, size: msg.video_note.file_size };
  if (msg.sticker) return { kind: "sticker", fileId: msg.sticker.file_id, name: `sticker_${msg.sticker.file_unique_id}.webp`, size: msg.sticker.file_size };
  if (msg.animation) return { kind: "animation", fileId: msg.animation.file_id, name: msg.animation.file_name, size: msg.animation.file_size };
  return null;
}

/** Format a Unix timestamp for use in file names: `YYYY-MM-DD-HH-MM-SS`. */
function formatTimestamp(sec) {
  const d = new Date(sec * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

/** Download an attachment from Telegram into the downloads directory. */
async function download(ctx, attachment) {
  const name = sanitize(attachment.name || attachment.kind);
  const filePath = path.join(DOWNLOADS_DIR, `${formatTimestamp(ctx.message.date)}-${name}`);
  // Skip re-downloading if the file already exists (same timestamp + name).
  if (existsSync(filePath)) return filePath;

  /** @type {URL} */
  const url = await ctx.telegram.getFileLink(attachment.fileId);
  const res = await fetch(url.href);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  await mkdir(DOWNLOADS_DIR, { recursive: true });
  await writeFile(filePath, Buffer.from(await res.arrayBuffer()));
  return filePath;
}

/**
 * Build a short textual summary of a message's attachment, downloading it
 * to disk as a side effect. Returns null for text-only messages.
 */
export async function describeAttachment(ctx) {
  const attachment = getAttachment(ctx.message);
  if (!attachment) return null;

  const size = formatSize(attachment.size);
  const summary =
    `[${attachment.kind}]${attachment.name ? ` ${attachment.name}` : ""}` +
    (size ? ` (${size})` : "");

  try {
    const filePath = await download(ctx, attachment);
    return `${summary} → ${filePath}`;
  } catch (err) {
    console.error("Failed to download attachment:", err);
    return `${summary} (download failed)`;
  }
}
