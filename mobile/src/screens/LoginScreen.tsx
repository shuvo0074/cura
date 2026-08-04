import { useCallback } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  businessRules,
  LoginViewModel,
  useViewModel,
  type AuthSession,
  type Theme,
} from '@cura/shared';
import { useServices } from '../app/services';
import { useTheme } from '../design/theme-provider';

/**
 * Login screen (View) — React Native.
 *
 * This renders the *same* `LoginViewModel` the web app uses. Validation rules,
 * the credentials → OTP transition, the resend countdown and error handling are
 * all inherited; only the widgets differ. That is the practical payoff of
 * keeping ViewModels free of platform APIs.
 */
export function LoginScreen({ onAuthenticated }: { onAuthenticated: (s: AuthSession) => void }) {
  const { auth } = useServices();
  const { theme } = useTheme();
  const styles = useStyles(theme);

  const [state, vm] = useViewModel(() => new LoginViewModel(auth, onAuthenticated));

  const submit = useCallback(() => {
    void (state.phase === 'credentials' ? vm.submitCredentials() : vm.submitOtp());
  }, [state.phase, vm]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>Cura</Text>
        <Text style={styles.title}>
          {state.phase === 'credentials' ? 'Sign in' : 'Verify it’s you'}
        </Text>

        {state.phase === 'credentials' ? (
          <>
            <Field label="Mobile number or email" error={state.fieldErrors.identifier} theme={theme}>
              <TextInput
                style={[styles.input, state.fieldErrors.identifier ? styles.inputError : null]}
                value={state.identifier}
                onChangeText={(v) => vm.setIdentifier(v)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="username"
                editable={!state.submitting}
                placeholderTextColor={theme.colors.text.muted}
                placeholder="01712345678"
              />
            </Field>

            <Field label="Password" error={state.fieldErrors.password} theme={theme}>
              <TextInput
                style={[styles.input, state.fieldErrors.password ? styles.inputError : null]}
                value={state.password}
                onChangeText={(v) => vm.setPassword(v)}
                secureTextEntry
                textContentType="password"
                editable={!state.submitting}
              />
            </Field>

            <View style={styles.row}>
              <Switch
                value={state.rememberMe}
                onValueChange={(v) => vm.setRememberMe(v)}
                disabled={state.submitting}
              />
              <Text style={styles.rowLabel}>
                Remember me for {businessRules.auth.rememberMeDays} days
              </Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.hint}>
              We sent a {businessRules.auth.otpLength}-digit code to{' '}
              <Text style={styles.strong}>{state.challenge?.maskedDestination}</Text>.
            </Text>

            <Field label="Verification code" theme={theme}>
              <TextInput
                style={[styles.input, styles.otp]}
                value={state.otpCode}
                onChangeText={(v) => vm.setOtpCode(v)}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                maxLength={businessRules.auth.otpLength}
                autoFocus
                editable={!state.submitting}
              />
            </Field>

            <Text style={styles.hint}>
              {state.resendAvailableInSeconds > 0
                ? `You can request a new code in ${state.resendAvailableInSeconds}s.`
                : 'You can request a new code now.'}
            </Text>
          </>
        )}

        {state.formError ? (
          <Text style={styles.formError} accessibilityRole="alert">
            {state.formError}
          </Text>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.submit, pressed && styles.submitPressed]}
          onPress={submit}
          disabled={state.submitting}
          accessibilityRole="button"
        >
          {state.submitting ? (
            <ActivityIndicator color={theme.colors.brand.onBrand} />
          ) : (
            <Text style={styles.submitLabel}>
              {state.phase === 'credentials' ? 'Sign in' : 'Verify'}
            </Text>
          )}
        </Pressable>

        {state.phase === 'otp' ? (
          <Pressable onPress={() => vm.backToCredentials()} accessibilityRole="button">
            <Text style={styles.secondary}>Use a different account</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  error,
  theme,
  children,
}: {
  label: string;
  error?: string | undefined;
  theme: Theme;
  children: React.ReactNode;
}) {
  const styles = useStyles(theme);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const useStyles = (theme: Theme) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: theme.colors.surface.canvas },
    container: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: theme.spacing.xl,
      gap: theme.spacing.lg,
    },
    brand: {
      fontSize: theme.typography.size.xl,
      fontWeight: '700',
      color: theme.colors.brand.default,
    },
    title: {
      fontSize: theme.typography.size.xxl,
      fontWeight: '600',
      color: theme.colors.text.primary,
    },
    field: { gap: theme.spacing.xs },
    label: {
      fontSize: theme.typography.size.sm,
      fontWeight: '500',
      color: theme.colors.text.secondary,
    },
    input: {
      padding: theme.spacing.md,
      fontSize: theme.typography.size.md,
      color: theme.colors.text.primary,
      backgroundColor: theme.colors.surface.raised,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
      borderRadius: theme.radius.md,
    },
    inputError: { borderColor: theme.colors.feedback.dangerFg },
    otp: { letterSpacing: 8, textAlign: 'center', fontSize: theme.typography.size.xl },
    row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    rowLabel: { fontSize: theme.typography.size.sm, color: theme.colors.text.secondary },
    hint: { fontSize: theme.typography.size.sm, color: theme.colors.text.muted },
    strong: { fontWeight: '600', color: theme.colors.text.primary },
    error: { fontSize: theme.typography.size.sm, color: theme.colors.feedback.dangerFg },
    formError: {
      padding: theme.spacing.md,
      fontSize: theme.typography.size.sm,
      color: theme.colors.feedback.dangerFg,
      backgroundColor: theme.colors.feedback.dangerBg,
      borderRadius: theme.radius.sm,
    },
    submit: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
      padding: theme.spacing.md,
      backgroundColor: theme.colors.brand.default,
      borderRadius: theme.radius.md,
    },
    submitPressed: { backgroundColor: theme.colors.brand.pressed },
    submitLabel: {
      fontSize: theme.typography.size.md,
      fontWeight: '600',
      color: theme.colors.brand.onBrand,
    },
    secondary: {
      textAlign: 'center',
      fontSize: theme.typography.size.sm,
      color: theme.colors.text.secondary,
    },
  });
