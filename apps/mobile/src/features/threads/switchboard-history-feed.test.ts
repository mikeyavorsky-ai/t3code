import { MessageId, ThreadId } from "@t3tools/contracts";
import { expect, it } from "vite-plus/test";
import type { ThreadFeedEntry } from "../../lib/threadActivity";
import {
  mergeSwitchboardHistoryFeed,
  type SwitchboardHistoryMessage,
} from "./switchboard-history-feed";

const threadId = ThreadId.make("thread");
const createdAt = "2026-01-01T00:00:00.000Z";
const row = (id: string, role: "user" | "assistant", text: string): SwitchboardHistoryMessage => ({
  id: MessageId.make(id),
  role,
  text,
  createdAt,
});
const history = [
  row("1", "user", "repeat"),
  row("2", "assistant", "response"),
  row("3", "user", "repeat"),
  row("4", "assistant", "response"),
  row("5", "user", "follow up"),
  row("6", "assistant", "finished"),
];
function projected(index: number, streaming = false): ThreadFeedEntry {
  const item = history[index]!;
  const id = MessageId.make(`legacy-${item.id}`);
  return {
    type: "message",
    id,
    createdAt,
    message: {
      ...item,
      id,
      updatedAt: createdAt,
      sourceThreadId: threadId,
      attachments: [],
      streaming,
      runId: null,
      visibility: "local",
    },
  };
}

it("inserts an external turn between legacy rows and preserves projected keys", () => {
  const feed = [projected(0), projected(1), projected(4), projected(5)];
  const merged = mergeSwitchboardHistoryFeed(feed, history, threadId, false);
  expect(merged.map((entry) => entry.id)).toEqual([
    "legacy-1",
    "legacy-2",
    "3",
    "4",
    "legacy-5",
    "legacy-6",
  ]);
  expect(merged[4]).toBe(feed[2]);
  expect(mergeSwitchboardHistoryFeed(merged, history, threadId, false)).toBe(merged);
});

it("keeps streamed rows and does not backfill before a paginated projection", () => {
  const streaming = [projected(4), projected(5, true)];
  expect(mergeSwitchboardHistoryFeed(streaming, history, threadId, false)).toBe(streaming);
  const page = [projected(4), projected(5)];
  expect(mergeSwitchboardHistoryFeed(page, history, threadId, true)).toBe(page);
});
