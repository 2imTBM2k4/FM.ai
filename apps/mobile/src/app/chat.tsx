import { MaterialCommunityIcons } from '@expo/vector-icons';
import { uuid } from 'expo';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Screen, styles } from '@/components/screen';
import { AIOrb } from '@/components/ui/ai-orb';
import { GlassCard } from '@/components/ui/glass-card';
import { Pill } from '@/components/ui/pill';
import {
  createSoftShadow,
  DesignRadius,
  DesignSpacing,
  useDesignTheme,
  useFinancePalette,
} from '@/constants/theme';
import { withDatabase } from '@/data/connection';
import {
  listChatMessages,
  saveChatMessage,
  type ChatRow,
} from '@/data/repository';
import { AICategoryBarChart } from '@/features/chat/ai-category-chart';
import { ChatComposer } from '@/features/chat/composer';
import { mergeChatMessages } from '@/features/chat/history';
import { vi } from '@/messages/vi';
import {
  defaultAIService,
  loadPersistedAIReplyMap,
  readAIServiceContext,
  savePersistedAIReply,
  type AIResponsePayload,
} from '@/services/ai-service';

const INTRO_SUGGESTION_CHIPS = [
  {
    id: 'budget-planner',
    label: vi.aiChipBudgetPlanner,
    icon: 'chart-pie' as const,
    prompt: vi.aiPromptBudgetPlanner,
  },
  {
    id: 'goal-tracker',
    label: vi.aiChipGoalTracker,
    icon: 'bullseye-arrow' as const,
    prompt: vi.aiPromptGoalTracker,
  },
  {
    id: 'spending-insights',
    label: vi.aiChipSpendingInsights,
    icon: 'chart-bar' as const,
    prompt: vi.aiPromptSpendingInsights,
  },
] as const;

/**
 * Renders both the AI Intro screen (large centered Skia AIOrb, title, 3 suggestion chips, input bar)
 * and the Chat AI conversation screen (right purple user bubbles, left AI bubbles with orb avatar
 * and category percentage column chart).
 */
export default function Chat() {
  const [messages, setMessages] = useState<ChatRow[]>([]);
  const [aiReplies, setAiReplies] = useState<Record<string, AIResponsePayload>>(
    {},
  );
  const [showIntro, setShowIntro] = useState(false);
  const [typingForId, setTypingForId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const cursor = useRef<ChatRow | undefined>(undefined);
  const paging = useRef(false);
  const mounted = useRef(true);

  const palette = useFinancePalette();
  const theme = useDesignTheme();
  const router = useRouter();

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async (before?: ChatRow) => {
    if (paging.current) return;
    paging.current = true;
    setLoading(true);
    try {
      const [rows, persistedReplies] = await Promise.all([
        withDatabase((db) => listChatMessages(db, before)),
        withDatabase(loadPersistedAIReplyMap),
      ]);
      if (!mounted.current) return;
      setMessages((current) =>
        before ? mergeChatMessages(current, rows) : rows,
      );
      setAiReplies((current) => ({ ...current, ...persistedReplies }));
      cursor.current = rows.at(-1);
      setMore(rows.length === 50);
      setLoadError(false);
    } catch {
      if (mounted.current) setLoadError(true);
    } finally {
      paging.current = false;
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      withDatabase((db) => listChatMessages(db)),
      withDatabase(loadPersistedAIReplyMap),
    ])
      .then(([rows, persistedReplies]) => {
        if (cancelled) return;
        setMessages(rows);
        setAiReplies(persistedReplies);
        cursor.current = rows.at(-1);
        setMore(rows.length === 50);
        setLoadError(false);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const triggerAIReply = useCallback(async (userMessage: ChatRow) => {
    setTypingForId(userMessage.id);
    try {
      const context = await readAIServiceContext();
      const reply = await defaultAIService.sendMessage(
        userMessage.text,
        context,
        userMessage.id,
      );
      await withDatabase((db) => savePersistedAIReply(db, reply));
      if (!mounted.current) return;
      setAiReplies((current) => ({
        ...current,
        [userMessage.id]: reply,
      }));
    } catch {
      // Keep user message visible even if local AI generation encounters an unexpected error
    } finally {
      if (mounted.current) {
        setTypingForId((current) =>
          current === userMessage.id ? null : current,
        );
      }
    }
  }, []);

  const onMessage = useCallback((message: ChatRow) => {
    setShowIntro(false);
    setMessages((current) => mergeChatMessages(current, [message]));
  }, []);

  const onAdviceSent = useCallback(
    (message: ChatRow) => {
      setShowIntro(false);
      void triggerAIReply(message);
    },
    [triggerAIReply],
  );

  const onMessageRemoved = useCallback((id: string) => {
    setMessages((current) => current.filter((message) => message.id !== id));
  }, []);

  const handleSuggestionChipPress = useCallback(
    async (prompt: string) => {
      if (typingForId) return;
      setShowIntro(false);
      const message: ChatRow = {
        id: uuid.v4(),
        text: prompt,
        created_at: new Date().toISOString(),
      };
      try {
        await withDatabase((db) =>
          saveChatMessage(db, message.id, message.text, message.created_at),
        );
        if (!mounted.current) return;
        setMessages((current) => mergeChatMessages(current, [message]));
        void triggerAIReply(message);
      } catch {
        if (mounted.current) setLoadError(true);
      }
    },
    [triggerAIReply, typingForId],
  );

  const getReplyForMessage = useCallback(
    (item: ChatRow): AIResponsePayload | null => {
      if (typingForId === item.id) return null;
      return aiReplies[item.id] ?? null;
    },
    [aiReplies, typingForId],
  );

  const isIntroVisible =
    showIntro || (!loading && messages.length === 0 && !typingForId);

  const renderMessage = useCallback(
    ({ item }: { item: ChatRow }) => {
      const reply = getReplyForMessage(item);
      const isItemTyping = typingForId === item.id;

      return (
        <View style={localStyles.turnGroup}>
          {/* User Message Bubble (Right-aligned, soft purple) */}
          <View style={localStyles.userRow}>
            <View
              style={[
                localStyles.userBubble,
                {
                  backgroundColor: theme.chat.userBubble,
                  borderColor: theme.brand.primaryBorder,
                },
              ]}
            >
              <Text
                selectable
                variant="bodyLarge"
                style={{
                  color: theme.chat.userText,
                  lineHeight: 22,
                }}
              >
                {item.text}
              </Text>
            </View>
            {!isItemTyping && !reply && (
              <View style={localStyles.userActionRow}>
                <Pill
                  label={vi.aiAnalyzeMessageBtn}
                  icon="creation"
                  tone="primary"
                  size="sm"
                  onPress={() => void triggerAIReply(item)}
                />
              </View>
            )}
          </View>

          {/* AI Assistant Response Bubble (Left-aligned with AIOrb avatar + Bar Chart) */}
          {isItemTyping ? (
            <View style={localStyles.aiRow}>
              <View style={localStyles.aiAvatarWrap}>
                <AIOrb size={34} animated />
              </View>
              <View
                style={[
                  localStyles.aiBubble,
                  localStyles.typingBubble,
                  {
                    backgroundColor: theme.chat.aiBubble,
                    borderColor: theme.card.border,
                  },
                ]}
              >
                <ActivityIndicator size={16} color={theme.brand.primary} />
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.text.secondary, fontWeight: '600' }}
                >
                  {vi.aiTyping}
                </Text>
              </View>
            </View>
          ) : reply ? (
            <View style={localStyles.aiRow}>
              <View style={localStyles.aiAvatarWrap}>
                <AIOrb size={34} animated={false} />
              </View>
              <View
                style={[
                  localStyles.aiBubble,
                  {
                    backgroundColor: theme.chat.aiBubble,
                    borderColor: theme.card.border,
                  },
                  createSoftShadow(theme.mode, 'sm'),
                ]}
              >
                <Text
                  selectable
                  variant="bodyMedium"
                  style={{ color: theme.chat.aiText, lineHeight: 21 }}
                >
                  {reply.replyText}
                </Text>
                {reply.chartItems && reply.chartItems.length > 0 && (
                  <AICategoryBarChart
                    title={reply.chartTitle}
                    items={reply.chartItems}
                  />
                )}
              </View>
            </View>
          ) : null}
        </View>
      );
    },
    [getReplyForMessage, theme, triggerAIReply, typingForId],
  );

  return (
    <SafeAreaView edges={['bottom']} style={styles.fill}>
      <Screen
        title={vi.chat}
        scroll={false}
        onBack={() => router.navigate('/')}
        headerRight={
          <View style={localStyles.headerActions}>
            {messages.length > 0 && (
              <Pill
                label={isIntroVisible ? vi.aiViewChat : vi.aiViewIntro}
                icon={isIntroVisible ? 'message-text-outline' : 'creation'}
                tone="primary"
                size="sm"
                onPress={() => setShowIntro((prev) => !prev)}
              />
            )}
          </View>
        }
      >
        {loadError && (
          <View style={styles.subtlePanel}>
            <Text accessibilityRole="alert" style={{ color: palette.danger }}>
              {vi.chatLoadError}
            </Text>
            <Button
              disabled={loading}
              onPress={() => void load(cursor.current)}
            >
              {vi.retry}
            </Button>
          </View>
        )}

        {isIntroVisible ? (
          /* SCREEN 2: AI INTRO (Large centered AIOrb, Hero Title, Suggestion Chips) */
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={localStyles.introContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={localStyles.orbHeroWrap}>
              <AIOrb size={168} />
            </View>

            <View style={localStyles.introTextGroup}>
              <Text
                variant="headlineSmall"
                style={[
                  localStyles.introTitle,
                  { color: theme.text.primary },
                ]}
              >
                {vi.aiIntroTitle}
              </Text>
              <Text
                variant="bodyMedium"
                style={[
                  localStyles.introSubtitle,
                  { color: theme.text.secondary },
                ]}
              >
                {vi.aiIntroSubtitle}
              </Text>
            </View>

            {/* 3 Suggestion Chips matching reference design: Budget Planner, Goal Tracker, Spending Insights */}
            <View style={localStyles.chipsContainer}>
              {INTRO_SUGGESTION_CHIPS.map((chip) => (
                <Pressable
                  key={chip.id}
                  accessibilityRole="button"
                  accessibilityLabel={chip.label}
                  onPress={() => void handleSuggestionChipPress(chip.prompt)}
                  style={({ pressed }) => [
                    localStyles.suggestionChip,
                    {
                      backgroundColor: theme.card.surfaceElevated,
                      borderColor: theme.card.border,
                      opacity: pressed ? 0.82 : 1,
                    },
                    createSoftShadow(theme.mode, 'sm'),
                  ]}
                >
                  <View
                    style={[
                      localStyles.chipIconBadge,
                      { backgroundColor: theme.brand.primarySoft },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={chip.icon}
                      size={18}
                      color={theme.brand.primary}
                    />
                  </View>
                  <Text
                    variant="labelLarge"
                    style={{ color: theme.text.primary, fontWeight: '700' }}
                  >
                    {chip.label}
                  </Text>
                  <MaterialCommunityIcons
                    name="arrow-top-right"
                    size={16}
                    color={theme.text.muted}
                  />
                </Pressable>
              ))}
            </View>

            {/* Quick-entry tip card */}
            <GlassCard
              variant="default"
              padding={DesignSpacing.md}
              radius="lg"
              style={localStyles.tipCard}
            >
              <View style={localStyles.tipRow}>
                <MaterialCommunityIcons
                  name="lightning-bolt-circle"
                  size={22}
                  color={theme.brand.primary}
                />
                <Text
                  variant="bodySmall"
                  style={{
                    color: theme.text.secondary,
                    flex: 1,
                    lineHeight: 18,
                  }}
                >
                  {vi.chatExplanation}
                </Text>
              </View>
            </GlassCard>
          </ScrollView>
        ) : (
          /* SCREEN 3: CHAT AI (Conversation List + Inline Suggestion Chips) */
          <View style={{ flex: 1, minHeight: 0 }}>
            <View style={localStyles.topChipsBar}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={localStyles.topChipsScroll}
              >
                {INTRO_SUGGESTION_CHIPS.map((chip) => (
                  <Pill
                    key={chip.id}
                    label={chip.label}
                    icon={chip.icon}
                    tone="glass"
                    size="sm"
                    onPress={() => void handleSuggestionChipPress(chip.prompt)}
                  />
                ))}
              </ScrollView>
            </View>

            <FlatList
              style={{ flex: 1, minHeight: 0 }}
              data={messages}
              inverted
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentInsetAdjustmentBehavior="never"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 8 }}
              ListFooterComponent={
                loading ? (
                  <ActivityIndicator accessibilityLabel={vi.loading} />
                ) : more ? (
                  <Button
                    mode="outlined"
                    disabled={loading}
                    onPress={() => void load(cursor.current)}
                  >
                    {vi.loadOlder}
                  </Button>
                ) : undefined
              }
            />
          </View>
        )}

        <ChatComposer
          disabled={loading || loadError}
          onMessage={onMessage}
          onMessageRemoved={onMessageRemoved}
          onAdviceSent={onAdviceSent}
        />
      </Screen>
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  introContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: DesignSpacing.md,
    paddingHorizontal: DesignSpacing.xs,
    gap: DesignSpacing.lg,
  },
  orbHeroWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  introTextGroup: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: DesignSpacing.md,
  },
  introTitle: {
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  introSubtitle: {
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: DesignRadius.pill,
    borderWidth: 1,
  },
  chipIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipCard: {
    width: '100%',
    maxWidth: 380,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topChipsBar: {
    marginBottom: 4,
  },
  topChipsScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  turnGroup: {
    gap: 10,
    marginBottom: 16,
  },
  userRow: {
    alignItems: 'flex-end',
    gap: 6,
  },
  userActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  userBubble: {
    maxWidth: '84%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    borderBottomRightRadius: 6,
    borderWidth: 1,
  },
  aiRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  aiAvatarWrap: {
    marginTop: 2,
  },
  aiBubble: {
    flex: 1,
    maxWidth: '86%',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 22,
    borderTopLeftRadius: 6,
    borderWidth: 1,
    gap: 8,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 0,
  },
});
