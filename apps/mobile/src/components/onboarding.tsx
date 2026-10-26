import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Button,
  HelperText,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { View } from 'react-native';
import { MAX_AMOUNT_VND } from '@pfm/domain';
import { Screen, styles } from '@/components/screen';
import { vi } from '@/messages/vi';
import { useApp } from '@/state/app';
import { PinSettings } from '@/features/lock/pin-controls';

export function Onboarding() {
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm({ defaultValues: { balance: '' } });
  const [error, setError] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const complete = useApp((state) => state.completeOnboarding);
  const theme = useTheme();
  const saving = useRef(false);
  async function save(balance: number) {
    if (saving.current) return;
    saving.current = true;
    setError(false);
    try {
      await complete(balance);
    } catch {
      setError(true);
    } finally {
      saving.current = false;
    }
  }
  return (
    <Screen title={vi.welcome}>
      <Text variant="bodyLarge">{vi.welcomeDescription}</Text>
      <View
        style={[styles.panel, { backgroundColor: theme.colors.surfaceVariant }]}
      >
        <Text variant="titleMedium">{vi.previewTitle}</Text>
        <Text variant="bodyMedium">{vi.previewDescription}</Text>
      </View>
      <Controller
        control={control}
        name="balance"
        rules={{
          validate: (value) =>
            value === '' ||
            (/^\d+$/.test(value) && Number(value) <= MAX_AMOUNT_VND) ||
            vi.invalidAmount,
        }}
        render={({ field: { value, onChange, onBlur }, fieldState }) => (
          <View>
            <TextInput
              mode="outlined"
              label={vi.startingBalance}
              accessibilityLabel={vi.startingBalance}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              keyboardType="number-pad"
              maxLength={12}
              error={!!fieldState.error}
              disabled={isSubmitting || skipping}
            />
            <HelperText type={fieldState.error ? 'error' : 'info'}>
              {fieldState.error?.message ?? vi.balanceHint}
            </HelperText>
          </View>
        )}
      />
      <PinSettings />
      {error && (
        <Text accessibilityRole="alert" style={{ color: theme.colors.error }}>
          {vi.saveError}
        </Text>
      )}
      <Button
        mode="contained"
        contentStyle={styles.button}
        loading={isSubmitting}
        disabled={isSubmitting || skipping}
        onPress={() => {
          void handleSubmit(({ balance }) => save(Number(balance || '0')))();
        }}
      >
        {vi.start}
      </Button>
      <Button
        contentStyle={styles.button}
        disabled={isSubmitting || skipping}
        loading={skipping}
        onPress={async () => {
          setSkipping(true);
          try {
            await save(0);
          } finally {
            setSkipping(false);
          }
        }}
      >
        {vi.skip}
      </Button>
    </Screen>
  );
}
