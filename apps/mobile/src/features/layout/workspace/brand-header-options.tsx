import type { ReactNode } from "react";
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { msg } from "gt-react-native";
import { nativeApplicationVersion, nativeBuildVersion } from "expo-application";
import { Platform, View } from "react-native";

import { AppText } from "../../../components/ui/AppText";

import { brandTitleOffset, CompactBrandTitle } from "../../../components/CompactBrandTitle";
import { WorkspaceConnectionTitle } from "../../home/WorkspaceConnectionTitle";
import { m, type MessageResolver } from "../../../i18n/messages";

export function WorkspaceBrandWithBuild({
  children,
  width,
}: {
  readonly children: ReactNode;
  readonly width: number;
}) {
  if (!nativeApplicationVersion || !nativeBuildVersion) return <>{children}</>;
  return (
    <View className="flex-row items-center gap-2" style={{ width }}>
      <View className="min-w-0 flex-1">{children}</View>
      <AppText className="shrink-0 text-right text-[10px] text-muted-foreground" numberOfLines={1}>
        {`v${nativeApplicationVersion}b${nativeBuildVersion}`}
      </AppText>
    </View>
  );
}

function renderCompactBrandTitle() {
  return <CompactBrandTitle allowFontScaling={Platform.OS === "ios"} />;
}

export function getCompactBrandHeaderOptions(
  fallbackTitleStyle?: NativeStackNavigationOptions["headerTitleStyle"],
  resolve: MessageResolver = m,
): NativeStackNavigationOptions {
  return {
    headerTitle: renderCompactBrandTitle,
    headerTitleStyle: fallbackTitleStyle,
    title: resolve(msg("Threads", { $context: "screen title, list of chat threads" })),
    unstable_headerLeftItems: undefined,
  };
}

export function getConnectionAwareBrandHeaderOptions(opts: {
  readonly headerWidth: number;
  readonly trailingItemCount?: number;
  readonly showBuildVersion?: boolean;
  readonly onOpenEnvironments: () => void;
  readonly fallbackTitleStyle?: NativeStackNavigationOptions["headerTitleStyle"];
  readonly resolve?: MessageResolver;
}): NativeStackNavigationOptions {
  const maxWidth = Math.max(0, opts.headerWidth - 64 - 44 * (opts.trailingItemCount ?? 1));

  const title = (
    <WorkspaceConnectionTitle
      brand={<CompactBrandTitle />}
      maxWidth={maxWidth}
      onPress={opts.onOpenEnvironments}
      statusOffset={brandTitleOffset()}
    />
  );
  return {
    ...getCompactBrandHeaderOptions(opts.fallbackTitleStyle, opts.resolve),
    headerTitle: () =>
      opts.showBuildVersion ? (
        <WorkspaceBrandWithBuild width={maxWidth}>{title}</WorkspaceBrandWithBuild>
      ) : (
        title
      ),
  };
}
