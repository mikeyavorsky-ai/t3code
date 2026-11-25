import { useEffect, useEffectEvent, useRef, useState } from "react";
import { View } from "react-native";
import { useGT } from "gt-react-native";
import {
  AuthOrchestrationOperateScope,
  type AcpRegistrySession,
  type ProviderInstanceId,
} from "@t3tools/contracts";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import { AppText } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";
import { serverEnvironment } from "../../state/server";
import { useEnvironmentScope } from "../../state/session";
import { useAtomCommand } from "../../state/use-atom-command";

export function ProjectSwitchboardSessions({
  project,
  onOpen,
}: {
  readonly project: Pick<EnvironmentProject, "environmentId" | "id">;
  readonly onOpen: (params: { environmentId: string; threadId: string }) => void;
}) {
  const gt = useGT();
  const list = useAtomCommand(serverEnvironment.listSwitchboardSessions);
  const link = useAtomCommand(serverEnvironment.importAcpRegistrySession);
  const canOperate = useEnvironmentScope(project.environmentId, AuthOrchestrationOperateScope);
  const [rows, setRows] = useState<readonly AcpRegistrySession[]>([]);
  const [instance, setInstance] = useState<ProviderInstanceId | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(false);
  const pending = useRef(false);

  async function run(action: () => Promise<void>, failure: string) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch {
      if (active.current) setError(failure);
    }
    pending.current = false;
    if (active.current) setBusy(false);
  }

  const load = (after: string | null) =>
    run(async () => {
      const result = await list({
        environmentId: project.environmentId,
        input: { projectId: project.id, ...(after === null ? {} : { cursor: after }) },
      });
      if (result._tag !== "Success") throw new Error("List failed");
      const page = result.value;
      if (!active.current) return;
      setInstance(page?.instanceId ?? null);
      setCursor(page?.nextCursor === after ? null : (page?.nextCursor ?? null));
      setRows((previous) => [
        ...new Map(
          [...(after === null ? [] : previous), ...(page?.sessions ?? [])].map((row) => [
            row.sessionId,
            row,
          ]),
        ).values(),
      ]);
    }, gt("Could not load durable sessions"));
  const loadFirst = useEffectEvent(() => {
    void load(null);
  });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- holds the project catalog request lifecycle while mounted.
  useEffect(() => {
    active.current = true;
    loadFirst();
    return () => {
      active.current = false;
    };
  }, []);

  if (rows.length === 0 && cursor === null && error === null) return null;
  return (
    <View>
      <AppText>{gt("Durable sessions")}</AppText>
      {rows.map((row) => (
        <Button
          key={row.sessionId}
          label={row.title || gt("Session {id}", { id: row.sessionId })}
          disabled={busy || !canOperate || instance === null}
          onPress={() => {
            if (!canOperate || instance === null) return;
            void run(async () => {
              const result = await link({
                environmentId: project.environmentId,
                input: { projectId: project.id, instanceId: instance, sessionId: row.sessionId },
              });
              if (result._tag !== "Success") throw new Error("Link failed");
              if (!active.current) return;
              setRows((previous) => previous.filter((item) => item.sessionId !== row.sessionId));
              onOpen({ environmentId: project.environmentId, threadId: result.value.threadId });
            }, gt("Could not open durable session"));
          }}
        />
      ))}
      {error !== null && <AppText>{error}</AppText>}
      {(cursor !== null || (error !== null && rows.length === 0)) && (
        <Button
          label={cursor === null ? gt("Retry") : gt("More durable sessions")}
          disabled={busy}
          onPress={() => {
            void load(cursor);
          }}
        />
      )}
    </View>
  );
}
