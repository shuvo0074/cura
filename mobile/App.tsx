import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { tokenStore, type AuthenticatedUser, type AuthSession, type Theme } from '@cura/shared';
import { ServicesProvider, useServices } from './src/app/services';
import { ThemeProvider, useTheme } from './src/design/theme-provider';
import { LoginScreen } from './src/screens/LoginScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';

type SessionState =
  | { status: 'restoring' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: AuthenticatedUser };

function Root() {
  const { auth, http } = useServices();
  const { theme, mode } = useTheme();
  const styles = useStyles(theme);
  const [session, setSession] = useState<SessionState>({ status: 'restoring' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await auth.restoreSession();
      if (!cancelled) setSession({ status: 'anonymous' });
    })();
    return () => {
      cancelled = true;
    };
  }, [auth]);

  // Session expiry is handled once, centrally — features never see a 401.
  useEffect(
    () =>
      http.onSessionExpired(() => {
        tokenStore.clear();
        setSession({ status: 'anonymous' });
      }),
    [http],
  );

  const handleAuthenticated = useCallback((next: AuthSession) => {
    setSession({ status: 'authenticated', user: next.user });
  }, []);

  const handleSignOut = useCallback(() => {
    void auth.logout();
    setSession({ status: 'anonymous' });
  }, [auth]);

  if (session.status === 'restoring') {
    return (
      <SafeAreaView style={styles.splash}>
        <ActivityIndicator color={theme.colors.brand.default} />
      </SafeAreaView>
    );
  }

  if (session.status === 'anonymous') {
    return (
      <SafeAreaView style={styles.flex}>
        <StatusBar
          barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
          backgroundColor={theme.colors.surface.raised}
        />
        <LoginScreen onAuthenticated={handleAuthenticated} />
      </SafeAreaView>
    );
  }

  const practiceId = session.user.practiceIds[0];

  return (
    <SafeAreaView style={styles.flex}>
      <StatusBar
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.surface.raised}
      />
      <View style={styles.header}>
        <Text style={styles.brand}>Cura</Text>
        <View style={styles.spacer} />
        <Text style={styles.user}>{session.user.fullName}</Text>
        <Pressable onPress={handleSignOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      {practiceId ? (
        <CalendarScreen practiceId={practiceId} />
      ) : (
        <Text style={styles.notice}>
          No practice is linked to this account yet. Complete onboarding to continue.
        </Text>
      )}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ServicesProvider>
        <Root />
      </ServicesProvider>
    </ThemeProvider>
  );
}

const useStyles = (theme: Theme) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: theme.colors.surface.canvas },
    splash: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface.canvas,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      height: theme.layout.headerHeight,
      backgroundColor: theme.colors.surface.raised,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.subtle,
    },
    brand: {
      fontSize: theme.typography.size.lg,
      fontWeight: '700',
      color: theme.colors.brand.default,
    },
    spacer: { flex: 1 },
    user: { fontSize: theme.typography.size.sm, color: theme.colors.text.secondary },
    signOut: { fontSize: theme.typography.size.sm, color: theme.colors.text.link },
    notice: {
      padding: theme.spacing.xxl,
      textAlign: 'center',
      color: theme.colors.text.muted,
    },
  });
