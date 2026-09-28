import { endianness } from "node:os";
import type { Readable, Writable } from "node:stream";

export const MAX_MESSAGE_BYTES = 1024 * 1024;
const HEADER_BYTES = 4;
const isLittleEndian = endianness() === "LE";

export class ResponseError extends Error {
  constructor(message: string, name: string) {
    super(message);
    this.name = name;
  }
}

export class MessageTooLargeError extends ResponseError {
  constructor() {
    super("Native message exceeds the size limit.", "MessageTooLargeError");
  }
}

export function encodeNativeMessage(message: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  if (body.length > MAX_MESSAGE_BYTES) {
    throw new MessageTooLargeError();
  }

  const header = Buffer.alloc(HEADER_BYTES);
  if (isLittleEndian) {
    header.writeUInt32LE(body.length);
  } else {
    header.writeUInt32BE(body.length);
  }
  return Buffer.concat([header, body]);
}

export async function* readNativeMessages(input: Readable): AsyncGenerator<unknown> {
  let pendingBytes: Buffer = Buffer.alloc(0);

  for await (const chunk of input) {
    pendingBytes = Buffer.concat([pendingBytes, Buffer.from(chunk)]);

    while (pendingBytes.length >= HEADER_BYTES) {
      const bodyLength = isLittleEndian
        ? pendingBytes.readUInt32LE(0)
        : pendingBytes.readUInt32BE(0);
      if (bodyLength === 0 || bodyLength > MAX_MESSAGE_BYTES) {
        throw new MessageTooLargeError();
      }

      const messageLength = HEADER_BYTES + bodyLength;
      if (pendingBytes.length < messageLength) break;

      const body = pendingBytes.subarray(HEADER_BYTES, messageLength);
      pendingBytes = pendingBytes.subarray(messageLength);
      yield JSON.parse(body.toString("utf8"));
    }
  }

  if (pendingBytes.length > 0) {
    throw new Error("Native messaging input ended before the message was complete.");
  }
}

export function writeNativeMessage(output: Writable, message: unknown) {
  const request = encodeNativeMessage(message);
  output.write(request);
}
