import { useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Text, TextInput, useTheme } from 'react-native-paper';
import { styles } from './screen';
import { vi } from '@/messages/vi';
import { useApp } from '@/state/app';

export function DeleteDataControl() {
  const { colors } = useTheme();
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const busy = useRef(false);
  const deleteData = useApp((state) => state.deleteData);
  if (!confirming)
    return (
      <Button
        textColor={colors.error}
        contentStyle={styles.button}
        onPress={() => setConfirming(true)}
      >
        {vi.deleteData}
      </Button>
    );
  return (
    <View style={{ gap: 16 }}>
      <Text>{vi.deleteExplanation}</Text>
      <TextInput
        label={vi.deletePrompt}
        accessibilityLabel={vi.deletePrompt}
        mode="outlined"
        value={confirmation}
        onChangeText={setConfirmation}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <Button
        mode="contained"
        buttonColor={colors.error}
        contentStyle={styles.button}
        disabled={confirmation !== vi.deleteWord}
        onPress={async () => {
          if (busy.current || confirmation !== vi.deleteWord) return;
          busy.current = true;
          try {
            await deleteData();
          } finally {
            busy.current = false;
          }
        }}
      >
        {vi.deleteData}
      </Button>
      <Button
        contentStyle={styles.button}
        onPress={() => {
          setConfirmation('');
          setConfirming(false);
        }}
      >
        {vi.cancel}
      </Button>
    </View>
  );
}
