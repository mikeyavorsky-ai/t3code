import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
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

type CatalogRow = { key: string; title: string; updatedAt: string; element: ReactNode };
type CatalogPage = { rows: readonly CatalogRow[]; footer: ReactNode };
type CatalogProject = Pick<EnvironmentProject, "environmentId" | "id">;
type OnOpen = (params: { environmentId: string; threadId: string }) => void;

export function SwitchboardSessionList({
  projects,
  query,
  onOpen,
}: {
  readonly projects: readonly CatalogProject[];
  readonly query: string;
  readonly onOpen: OnOpen;
}) {
  const [pages, setPages] = useState<Record<string, CatalogPage>>({});
  const keys = projects.map((p) => `${p.environmentId}:${p.id}`);
  const visiblePages = keys.flatMap((key) => (pages[key] ? [pages[key]] : []));
  const rows = visiblePages
    .flatMap((page) => page.rows)
    .filter((row) => row.title.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.key.localeCompare(b.key));
  return (
    <View>
      {projects.map((project, i) => (
        <ProjectSwitchboardSessions
          key={keys[i]}
          project={project}
          onOpen={onOpen}
          onPage={(key, page) => setPages((previous) => ({ ...previous, [key]: page }))}
        />
      ))}
      {rows.map((row) => row.element)}
      {visiblePages.map((page) => page.footer)}
    </View>
  );
}

function ProjectSwitchboardSessions({
  project,
  onOpen,
  onPage,
}: {
  readonly project: Pick<EnvironmentProject, "environmentId" | "id">;
  readonly onPage: (key: string, page: CatalogPage) => void;
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
        input: {
          includeLinked: true,
          projectId: project.id,
          ...(after === null ? {} : { cursor: after }),
        },
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

  const key = `${project.environmentId}:${project.id}`;
  const renderedRows = rows.map((row) => ({
    key: `${key}:${row.sessionId}`,
    title: row.title || gt("Session {id}", { id: row.sessionId }),
    updatedAt: row.updatedAt ?? "",
    element: (
      <Pressable
        key={`${key}:${row.sessionId}`}
        accessibilityRole="button"
        className="min-h-12 justify-center border-b border-border/50 px-3 py-2 active:bg-muted"
        disabled={
          busy ||
          ((row.importedThreadId === null || row.nativeHistoryPending) &&
            (!canOperate || instance === null))
        }
        onPress={() => {
          if (row.importedThreadId !== null && !row.nativeHistoryPending) {
            onOpen({ environmentId: project.environmentId, threadId: row.importedThreadId });
            return;
          }
          if (!canOperate || instance === null) return;
          void run(async () => {
            const result = await link({
              environmentId: project.environmentId,
              input: { projectId: project.id, instanceId: instance, sessionId: row.sessionId },
            });
            if (result._tag !== "Success") throw new Error("Link failed");
            if (!active.current) return;
            setRows((previous) =>
              previous.map((item) =>
                item.sessionId === row.sessionId
                  ? {
                      ...item,
                      importedThreadId: result.value.threadId,
                      nativeHistoryPending: false,
                    }
                  : item,
              ),
            );
            onOpen({ environmentId: project.environmentId, threadId: result.value.threadId });
          }, gt("Could not open durable session"));
        }}
      >
        <AppText className="text-base font-t3-medium" numberOfLines={2}>
          {row.title || gt("Session {id}", { id: row.sessionId })}
        </AppText>
      </Pressable>
    ),
  }));
  const footer = (
    <View key={key}>
      {error !== null && (
        <AppText accessibilityRole="alert" className="px-3 py-2 text-sm text-muted-foreground">
          {error}
        </AppText>
      )}
      {(cursor !== null || (error !== null && rows.length === 0)) && (
        <Button
          label={cursor === null ? gt("Retry") : gt("Show more")}
          disabled={busy}
          onPress={() => {
            void load(cursor);
          }}
        />
      )}
    </View>
  );
  const publish = useEffectEvent(() => onPage(key, { rows: renderedRows, footer }));
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Publish catalog responses to the combined list.
  useEffect(() => {
    publish();
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- Republish the view when its inputs change.
  }, [rows, cursor, busy, error, instance, canOperate]);
  return null;
}
