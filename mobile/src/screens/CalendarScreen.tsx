import { useCallback, useEffect, useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  AppointmentStatus,
  CalendarViewModel,
  useViewModel,
  visitTypePrefix,
  type Appointment,
  type Theme,
} from '@cura/shared';
import { useServices } from '../app/services';
import { useTheme } from '../design/theme-provider';

/**
 * Day agenda (View) — React Native.
 *
 * Backed by the same `CalendarViewModel` as the web grid, so request
 * cancellation, the range cache and optimistic status updates all behave
 * identically. `FlatList` supplies the virtualisation the DOM version gets from
 * `contain: content` plus per-lane scrolling — a long clinic day renders only
 * the rows on screen.
 */
export function CalendarScreen({ practiceId, doctorId }: { practiceId: string; doctorId?: string }) {
  const { appointments } = useServices();
  const { theme } = useTheme();
  const styles = useStyles(theme);

  const [state, vm] = useViewModel(
    () => new CalendarViewModel(appointments, practiceId, doctorId),
  );

  useEffect(() => {
    vm.setView('day');
    void vm.initialise();
  }, [vm]);

  const rows = useMemo(() => state.lanes.flatMap((lane) => lane.appointments), [state.lanes]);

  const renderItem = useCallback(
    ({ item }: { item: Appointment }) => (
      <AppointmentRow
        appointment={item}
        selected={item.id === state.selectedAppointmentId}
        onSelect={() => vm.select(item.id)}
        onCheckIn={() => void vm.changeStatus(item.id, AppointmentStatus.WAITING)}
        theme={theme}
      />
    ),
    [state.selectedAppointmentId, vm, theme],
  );

  const keyExtractor = useCallback((item: Appointment) => item.id, []);

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Pressable onPress={() => vm.shift(-1)} accessibilityLabel="Previous day">
          <Text style={styles.navButton}>‹</Text>
        </Pressable>
        <Text style={styles.anchor}>{state.anchorDate}</Text>
        <Pressable onPress={() => vm.shift(1)} accessibilityLabel="Next day">
          <Text style={styles.navButton}>›</Text>
        </Pressable>
        <View style={styles.spacer} />
        <Pressable onPress={() => vm.goToToday()}>
          <Text style={styles.today}>Today</Text>
        </Pressable>
      </View>

      {state.queue ? (
        <View style={styles.counters}>
          <Counter label="Waiting" value={state.queue.waiting} tone="waiting" theme={theme} />
          <Counter label="Engaged" value={state.queue.engaged} tone="engaged" theme={theme} />
          <Counter label="Done" value={state.queue.done} tone="done" theme={theme} />
          <Counter label="Cancelled" value={state.queue.cancelled} tone="cancelled" theme={theme} />
        </View>
      ) : null}

      <FlatList
        data={rows}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.list}
        refreshing={state.loading}
        onRefresh={() => void vm.load()}
        // Windowing bounds: keeps memory flat on a 60-appointment day.
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews
        ListEmptyComponent={
          <Text style={styles.empty}>
            {state.error ?? (state.loading ? 'Loading…' : 'No appointments for this day.')}
          </Text>
        }
      />
    </View>
  );
}

function AppointmentRow({
  appointment,
  selected,
  onSelect,
  onCheckIn,
  theme,
}: {
  appointment: Appointment;
  selected: boolean;
  onSelect: () => void;
  onCheckIn: () => void;
  theme: Theme;
}) {
  const styles = useStyles(theme);
  const tone = statusTone(appointment.status, theme);

  const time = useMemo(
    () =>
      new Date(appointment.scheduledAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    [appointment.scheduledAt],
  );

  return (
    <Pressable
      onPress={onSelect}
      style={[
        styles.row,
        { borderLeftColor: tone.fg, backgroundColor: tone.bg },
        selected && styles.rowSelected,
      ]}
    >
      <Text style={styles.rowTime}>{time}</Text>
      <View style={styles.rowMain}>
        <Text style={styles.rowName} numberOfLines={1}>
          <Text style={[styles.badge, { color: tone.fg }]}>
            {visitTypePrefix[appointment.visitType]}{' '}
          </Text>
          {appointment.patient.fullName}
        </Text>
        <Text style={styles.rowMeta}>
          {appointment.patient.curaId}
          {appointment.tokenNumber !== null ? ` · #${appointment.tokenNumber}` : ''}
        </Text>
      </View>
      {appointment.status === AppointmentStatus.SCHEDULED ? (
        <Pressable onPress={onCheckIn} style={styles.action}>
          <Text style={styles.actionLabel}>Check in</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

function Counter({
  label,
  value,
  tone,
  theme,
}: {
  label: string;
  value: number;
  tone: keyof Theme['colors']['status'] | string;
  theme: Theme;
}) {
  const styles = useStyles(theme);
  const colours = statusToneByName(tone, theme);
  return (
    <View style={[styles.counter, { backgroundColor: colours.bg }]}>
      <Text style={[styles.counterValue, { color: colours.fg }]}>{value}</Text>
      <Text style={[styles.counterLabel, { color: colours.fg }]}>{label}</Text>
    </View>
  );
}

function statusTone(status: AppointmentStatus, theme: Theme): { fg: string; bg: string } {
  const s = theme.colors.status;
  switch (status) {
    case AppointmentStatus.WAITING:
      return { fg: s.waiting, bg: s.waitingBg };
    case AppointmentStatus.ENGAGED:
      return { fg: s.engaged, bg: s.engagedBg };
    case AppointmentStatus.DONE:
      return { fg: s.done, bg: s.doneBg };
    case AppointmentStatus.CANCELLED:
    case AppointmentStatus.NO_SHOW:
      return { fg: s.cancelled, bg: s.cancelledBg };
    default:
      return { fg: theme.colors.border.strong, bg: theme.colors.surface.raised };
  }
}

function statusToneByName(name: string, theme: Theme): { fg: string; bg: string } {
  const s = theme.colors.status;
  const map: Record<string, { fg: string; bg: string }> = {
    waiting: { fg: s.waiting, bg: s.waitingBg },
    engaged: { fg: s.engaged, bg: s.engagedBg },
    done: { fg: s.done, bg: s.doneBg },
    cancelled: { fg: s.cancelled, bg: s.cancelledBg },
  };
  return map[name] ?? { fg: theme.colors.text.muted, bg: theme.colors.surface.sunken };
}

const useStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.surface.canvas },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      height: theme.layout.headerHeight,
      backgroundColor: theme.colors.surface.raised,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.subtle,
    },
    navButton: {
      fontSize: theme.typography.size.xxl,
      color: theme.colors.text.secondary,
      paddingHorizontal: theme.spacing.sm,
    },
    anchor: {
      fontSize: theme.typography.size.md,
      fontWeight: '600',
      color: theme.colors.text.primary,
    },
    spacer: { flex: 1 },
    today: {
      fontSize: theme.typography.size.sm,
      fontWeight: '600',
      color: theme.colors.brand.default,
    },
    counters: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
      padding: theme.spacing.md,
    },
    counter: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.sm,
    },
    counterValue: { fontSize: theme.typography.size.xl, fontWeight: '700' },
    counterLabel: { fontSize: theme.typography.size.xs, textTransform: 'uppercase' },
    list: { padding: theme.spacing.md, gap: theme.spacing.xs },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      borderLeftWidth: 3,
      borderRadius: theme.radius.sm,
      marginBottom: theme.spacing.xs,
    },
    rowSelected: { borderWidth: 1, borderColor: theme.colors.border.focus },
    rowTime: {
      fontSize: theme.typography.size.sm,
      color: theme.colors.text.muted,
      fontVariant: ['tabular-nums'],
    },
    rowMain: { flex: 1, minWidth: 0 },
    rowName: { fontSize: theme.typography.size.md, color: theme.colors.text.primary },
    rowMeta: { fontSize: theme.typography.size.xs, color: theme.colors.text.muted },
    badge: { fontWeight: '700' },
    action: {
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.brand.default,
    },
    actionLabel: { fontSize: theme.typography.size.xs, color: theme.colors.brand.onBrand },
    empty: {
      padding: theme.spacing.xxl,
      textAlign: 'center',
      color: theme.colors.text.muted,
    },
  });
