import type { MessageId, ThreadId } from "@t3tools/contracts";
import type { ThreadFeedEntry } from "../../lib/threadActivity";

export interface SwitchboardHistoryMessage {
  readonly id: MessageId;
  readonly role: "user" | "assistant";
  readonly text: string;
  readonly createdAt: string;
}

/** Keep projection rows (and their keys/metadata) and add only missing canonical rows. */
export function mergeSwitchboardHistoryFeed(
  feed: ReadonlyArray<ThreadFeedEntry>,
  history: ReadonlyArray<SwitchboardHistoryMessage>,
  threadId: ThreadId,
  hasEarlierProjection: boolean,
): ReadonlyArray<ThreadFeedEntry> {
  if (history.length === 0) return feed;
  const matches = new Map<number, number>();
  let unmatchedRun = false;
  const step = hasEarlierProjection ? -1 : 1;
  let cursor = hasEarlierProjection ? history.length - 1 : 0;
  for (
    let index = step < 0 ? feed.length - 1 : 0;
    index >= 0 && index < feed.length;
    index += step
  ) {
    const entry = feed[index]!;
    if (entry.type !== "message" || entry.message.streaming) continue;
    const message = entry.message;
    // Prefer exact IDs; older projected rows have unrelated IDs, so match by
    // ordered content rather than removing every occurrence of repeated text.
    let match = -1;
    for (let position = cursor; position >= 0 && position < history.length; position += step) {
      const row = history[position]!;
      if (row.id === message.id) {
        match = position;
        break;
      }
      if (match < 0 && row.role === message.role && row.text.trim() === message.text.trim()) {
        match = position;
      }
    }
    // A cancelled turn may exist only in the projection. Keep it, but require
    // a subsequent match before trusting this snapshot to add canonical rows.
    if (match < 0) {
      if (step < 0 && matches.size === 0) return feed;
      unmatchedRun = true;
      continue;
    }
    unmatchedRun = false;
    matches.set(index, match);
    cursor = match + step;
  }
  if (unmatchedRun || (matches.size === 0 && feed.some((entry) => entry.type === "message"))) {
    return feed;
  }

  const merged: ThreadFeedEntry[] = [];
  let next = hasEarlierProjection ? cursor + 1 : 0;
  const appendUntil = (end: number) => {
    while (next < end) {
      const row = history[next++]!;
      merged.push({
        type: "message",
        id: row.id,
        createdAt: row.createdAt,
        message: {
          ...row,
          updatedAt: row.createdAt,
          sourceThreadId: threadId,
          attachments: [],
          streaming: false,
          runId: null,
          visibility: "local",
        },
      });
    }
  };
  for (const [index, entry] of feed.entries()) {
    const match = matches.get(index);
    if (match !== undefined) {
      appendUntil(match);
      next = match + 1;
    } else if (entry.type === "message" && entry.message.streaming) {
      // The live reply must remain last. Do not show a second copy if the
      // provider's completed snapshot races ahead of the streamed projection.
      return feed;
    }
    merged.push(entry);
  }
  appendUntil(history.length);
  return merged.length === feed.length ? feed : merged;
}
