import { Readable } from "node:stream";
import yauzl from "yauzl";

/**
 * Limits for a bulk import ZIP. The ZIP is read in place from its temporary file: no entry is ever
 * written to disk under a name taken from the archive, and one entry at a time is held in memory.
 */
export const ZIP_LIMITS = {
  /** Compressed size of the upload; also the multipart parser's limit. */
  zipBytes: 200 * 1024 * 1024,
  entries: 2000,
  /** Uncompressed size of any one file (the largest audio clip an editor upload allows). */
  entryBytes: 25 * 1024 * 1024,
  /** Uncompressed size of everything together. */
  totalBytes: 400 * 1024 * 1024,
  csvBytes: 2 * 1024 * 1024,
} as const;

/** A whole-archive refusal; `code` is a stable message key. */
export class ZipRefusal extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export type ZipEntry = { name: string; size: number };

/** What the dashboard never imports: metadata the operating system adds when zipping a folder. */
export const isJunk = (name: string) => name.startsWith("__MACOSX/") || name.split("/").some((part) => part === ".DS_Store" || part.startsWith("._") || part === "Thumbs.db");

const unsafe = (name: string) => name.includes("\0") || name.includes("\\") || name.startsWith("/") || /^[a-zA-Z]:/.test(name) || name.split("/").some((part) => part === "..");

export class OpenZip {
  constructor(
    private readonly file: yauzl.ZipFile,
    /** Files only, in archive order; directories and junk are already left out. */
    readonly entries: ZipEntry[],
    private readonly raw: Map<string, yauzl.Entry>,
    /** How many junk entries were skipped. */
    readonly ignored: number,
  ) {}

  has(name: string) {
    return this.raw.has(name);
  }

  size(name: string) {
    return this.raw.get(name)?.uncompressedSize;
  }

  /** A stream that stops with an error if the data outgrows what the archive declared. */
  stream(name: string): Promise<Readable> {
    const entry = this.raw.get(name);
    if (!entry) return Promise.reject(new ZipRefusal("zip_entry_missing"));
    return new Promise((resolve, reject) => {
      // yauzl validates that the real length equals the declared one, so a lying header cannot inflate past `size`.
      this.file.openReadStream(entry, (error, stream) => {
        if (error || !stream) return reject(new ZipRefusal(entry.isEncrypted() ? "zip_encrypted" : "zip_entry_unreadable"));
        resolve(stream);
      });
    });
  }

  async read(name: string, maxBytes: number): Promise<Buffer> {
    const declared = this.size(name);
    if (declared === undefined) throw new ZipRefusal("zip_entry_missing");
    if (declared > maxBytes) throw new ZipRefusal("file_too_large");
    const stream = await this.stream(name);
    // Collected from events: iterating yauzl's stream with for-await never settles.
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let total = 0;
      stream.on("data", (chunk: Buffer) => {
        total += chunk.length;
        if (total > maxBytes) {
          stream.destroy();
          reject(new ZipRefusal("file_too_large"));
        } else chunks.push(chunk);
      });
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("error", () => reject(new ZipRefusal("zip_entry_unreadable")));
    });
  }

  close() {
    this.file.close();
  }
}

/**
 * Opens and lists an archive, refusing anything unsafe before a single file is read: too many
 * entries, oversized entries or total, unsafe names, duplicate names, symbolic links, nesting
 * deeper than one folder, and ZIPs that cannot be parsed.
 */
export function openZip(path: string): Promise<OpenZip> {
  return new Promise((resolve, reject) => {
    yauzl.open(path, { lazyEntries: true, autoClose: false, strictFileNames: true, validateEntrySizes: true, decodeStrings: true }, (error, file) => {
      if (error || !file) return reject(new ZipRefusal(/invalid relative path|absolute path|invalid characters in fileName/.test(error?.message ?? "") ? "zip_unsafe_path" : "zip_unreadable"));
      const raw = new Map<string, yauzl.Entry>();
      const entries: ZipEntry[] = [];
      let total = 0, ignored = 0;
      const fail = (code: string) => {
        file.close();
        reject(new ZipRefusal(code));
      };
      if (file.entryCount > ZIP_LIMITS.entries) return fail("zip_too_many_entries");
      file.on("error", (e) => fail(/invalid relative path|absolute path|invalid characters in fileName/.test(e.message) ? "zip_unsafe_path" : "zip_unreadable"));
      file.on("end", () => resolve(new OpenZip(file, entries, raw, ignored)));
      file.on("entry", (entry: yauzl.Entry) => {
        const name = entry.fileName;
        if (unsafe(name)) return fail("zip_unsafe_path");
        if (name.endsWith("/")) {
          // A directory entry only matters for how deep it nests.
          if (!isJunk(name) && name.split("/").filter(Boolean).length > 1) return fail("zip_nested");
          return file.readEntry();
        }
        if (isJunk(name)) {
          ignored++;
          return file.readEntry();
        }
        // The upper 16 bits of the external attributes hold the Unix mode; 0o120000 is a symbolic link.
        if (((entry.externalFileAttributes >>> 16) & 0o170000) === 0o120000) return fail("zip_unsafe_path");
        if (name.split("/").length > 2) return fail("zip_nested");
        if (raw.has(name)) return fail("zip_duplicate_name");
        if (entry.uncompressedSize > ZIP_LIMITS.entryBytes) return fail("zip_entry_too_large");
        total += entry.uncompressedSize;
        if (total > ZIP_LIMITS.totalBytes) return fail("zip_too_large");
        raw.set(name, entry);
        entries.push({ name, size: entry.uncompressedSize });
        file.readEntry();
      });
      file.readEntry();
    });
  });
}
