import React from "react";
import { StyleSheet, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import {
  Card,
  EmptyView,
  ErrorView,
  ListRow,
  Muted,
  ProgressBar,
  Screen,
  useLoad,
} from "@/components/kit";
import { SkeletonCard, StaleNotice } from "@/components/states";
import { useDataVersion } from "@/context/data-version";
import { schoolApi } from "@/services/school-api";

/** The batches a teacher teaches, each with its coverage; a batch opens its own page (Syllabus · Students · Tests). */
export function TeacherBatchesScreen() {
  const version = useDataVersion();
  const router = useRouter();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(
    () => schoolApi.teacherOverview(),
    [version],
  );

  return (
    <Screen
      title="Your batches"
      subtitle="Students, timings and syllabus progress"
      onRefresh={refresh}
      refreshing={refreshing}
    >
      {loading ? (
        <SkeletonCard rows={4} label="your batches" />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : !data?.batches.length ? (
        <Card>
          <EmptyView
            icon={{ ios: "square.grid.2x2", android: "grid_view" }}
            title="No batches yet"
            text="Your tuition assigns you to batches and subjects. They show here once it does."
          />
        </Card>
      ) : (
        <>
          {error ? <StaleNotice message={error} onRetry={reload} /> : null}
          {data.batches.map((b) => (
            <Card key={b.id}>
              <ListRow
                title={b.name}
                subtitle={`${b.studentCount} student${b.studentCount === 1 ? "" : "s"} · You teach ${b.mySubjects.join(", ")}`}
                onPress={() => router.push(`/teach/${b.id}` as Href)}
                last
              />
              {b.mySubjects.map((s) => (
                <View key={s} style={styles.coverage}>
                  <View style={styles.coverageTop}>
                    <Muted>{s}</Muted>
                    <Muted>
                      {b.coverage[s]?.total
                        ? `${b.coverage[s].percent}% covered`
                        : "No syllabus"}
                    </Muted>
                  </View>
                  <ProgressBar value={b.coverage[s]?.percent ?? 0} />
                </View>
              ))}
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  coverage: { gap: 4 },
  coverageTop: { flexDirection: "row", justifyContent: "space-between" },
});
