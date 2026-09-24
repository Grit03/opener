import { endianness } from "node:os";
import { Readable } from "node:stream";
import { describe, expect, test } from "vitest";
import {
  encodeNativeMessage,
  MAX_MESSAGE_BYTES,
  readNativeMessages,
} from "../src/native-messaging.ts";

function frameHeader(length: number): Buffer {
  const header = Buffer.alloc(4);
  if (endianness() === "LE") header.writeUInt32LE(length);
  else header.writeUInt32BE(length);
  return header;
}

async function decode(chunks: Buffer[]): Promise<unknown[]> {
  const messages = [];
  for await (const message of readNativeMessages(Readable.from(chunks))) messages.push(message);
  return messages;
}

describe("native message encoding", () => {
  test("prefixes Korean JSON with its UTF-8 byte length", () => {
    const frame = encodeNativeMessage("안녕");

    expect(frame).toStrictEqual(Buffer.concat([frameHeader(8), Buffer.from('"안녕"')]));
  });

  test("rejects a message larger than the byte limit", () => {
    expect(() => encodeNativeMessage("a".repeat(MAX_MESSAGE_BYTES))).toThrow();
  });
});

describe("native message decoding", () => {
  test.each([
    { scenario: "a fragmented header", split: 2 },
    { scenario: "a fragmented UTF-8 character", split: 6 },
    { scenario: "a fragmented body", split: 11 },
  ])("decodes $scenario", async ({ split }) => {
    const frame = Buffer.concat([frameHeader(8), Buffer.from('"안녕"')]);

    const messages = await decode([frame.subarray(0, split), frame.subarray(split)]);

    expect(messages).toStrictEqual(["안녕"]);
  });

  test("decodes adjacent messages in order", async () => {
    const frames = Buffer.concat([
      frameHeader(1),
      Buffer.from("1"),
      frameHeader(1),
      Buffer.from("2"),
    ]);

    const messages = await decode([frames]);

    expect(messages).toStrictEqual([1, 2]);
  });

  test("decodes a fragmented message followed by another message in the same chunk", async () => {
    const frame = Buffer.concat([frameHeader(8), Buffer.from('"안녕"')]);

    const messages = await decode([
      frame.subarray(0, 2),
      frame.subarray(2, 11),
      Buffer.concat([frame.subarray(11), frameHeader(1), Buffer.from("2")]),
    ]);

    expect(messages).toStrictEqual(["안녕", 2]);
  });

  test.each([
    { reason: "an oversized length", frame: frameHeader(MAX_MESSAGE_BYTES + 1) },
    { reason: "invalid JSON", frame: Buffer.concat([frameHeader(1), Buffer.from("!")]) },
    { reason: "a truncated header", frame: frameHeader(8).subarray(0, 2) },
    { reason: "a truncated body", frame: Buffer.concat([frameHeader(8), Buffer.from('"')]) },
  ])("rejects $reason", async ({ frame }) => {
    await expect(decode([frame])).rejects.toThrow();
  });
});
