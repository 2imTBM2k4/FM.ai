import { uuid } from 'expo';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { Screen, styles } from '@/components/screen';
import { withDatabase } from '@/data/connection';
import {
  listChatMessages,
  saveChatMessage,
  type ChatRow,
} from '@/data/repository';
import { vi } from '@/messages/vi';
import { mergeChatMessages } from '@/features/chat/history';

export default function Chat() {
  const [messages, setMessages] = useState<ChatRow[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const cursor = useRef<ChatRow | undefined>(undefined);
  const { colors } = useTheme();
  const load = useCallback(async (before?: ChatRow) => {
    try {
      const rows = await withDatabase((db) => listChatMessages(db, before));
      setMessages((current) =>
        before ? mergeChatMessages(current, rows) : rows,
      );
      cursor.current = rows.at(-1);
      setMore(rows.length === 50);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    withDatabase(listChatMessages)
      .then((rows) => {
        if (cancelled) return;
        setMessages(rows);
        cursor.current = rows.at(-1);
        setMore(rows.length === 50);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  async function send() {
    if (busy.current || !draft.trim() || loading || loadError) return;
    busy.current = true;
    setSaving(true);
    setSaveError(false);
    try {
      const text = draft.trim();
      const id = uuid.v4();
      const created_at = new Date().toISOString();
      await withDatabase((db) => saveChatMessage(db, id, text, created_at));
      setMessages((current) =>
        mergeChatMessages(current, [{ id, text, created_at }]),
      );
      setDraft('');
    } catch {
      setSaveError(true);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  const renderMessage = useCallback(
    ({ item }: { item: ChatRow }) => (
      <View
        style={[
          styles.panel,
          { backgroundColor: colors.surface, gap: 8, marginBottom: 12 },
        ]}
      >
        <Text selectable variant="bodyLarge">
          {item.text}
        </Text>
        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
          {vi.localMessage}
        </Text>
      </View>
    ),
    [colors.surface, colors.onSurfaceVariant],
  );
  return (
    <Screen title={vi.chat} scroll={false}>
      <View style={{ gap: 8 }}>
        <Text variant="titleMedium">{vi.chatDisconnected}</Text>
        <Text>{vi.chatExplanation}</Text>
      </View>
      {loadError && (
        <View>
          <Text accessibilityRole="alert">{vi.chatLoadError}</Text>
          <Button
            disabled={loading}
            onPress={() => {
              setLoading(true);
              void load(cursor.current);
            }}
          >
            {vi.retry}
          </Button>
        </View>
      )}
      <FlatList
        style={{ flex: 1, minHeight: 100 }}
        data={messages}
        inverted
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          !loading && !loadError ? <Text>{vi.chatEmpty}</Text> : undefined
        }
        ListFooterComponent={
          loading ? (
            <ActivityIndicator accessibilityLabel={vi.loading} />
          ) : more ? (
            <Button
              onPress={() => {
                setLoading(true);
                void load(cursor.current);
              }}
            >
              {vi.loadOlder}
            </Button>
          ) : undefined
        }
      />
      <View style={{ gap: 8 }}>
        <TextInput
          mode="outlined"
          label={vi.chatInput}
          accessibilityLabel={vi.chatInput}
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={500}
          disabled={saving}
          style={{ maxHeight: 160 }}
        />
        <Text variant="bodySmall">{vi.chatLimit}</Text>
        {saveError && (
          <Text accessibilityRole="alert" style={{ color: colors.error }}>
            {vi.saveError}
          </Text>
        )}
        <Button
          mode="contained"
          contentStyle={styles.button}
          loading={saving}
          disabled={saving || loading || loadError || !draft.trim()}
          onPress={send}
        >
          {vi.send}
        </Button>
      </View>
    </Screen>
  );
}
