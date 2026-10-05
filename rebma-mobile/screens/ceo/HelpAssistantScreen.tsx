// rebma-mobile/screens/ceo/HelpAssistantScreen.tsx
//
// Direct instruction: a chatbot that lives ONLY in the CEO's department
// (no one and nowhere else — enforced by only adding this subTab to
// DEPARTMENT_REGISTRY.CEO, never to any other department's entry),
// trained on the whole app, so a real report like "mobile login is
// blocked" can be typed here and get pointed straight at the right
// Control Center setting or department page.
//
// Direct correction on "trained": a smart search/helper tool, not a
// real AI service — no API key, no backend call, no per-message cost.
// lib/helpKnowledgeBase.ts does deterministic keyword matching over
// real app data (Control Center's own SECTIONS array + the live
// department registry + a few hand-written cross-department workflow
// notes), so every answer is grounded in something real in this app —
// it can't invent an answer that doesn't exist.
import { useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Bot, Send, ArrowRight } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { useUIStore } from '../../store/uiStore';
import { DEPARTMENT_REGISTRY, getDepartmentEntry } from '../../navigation/departmentRegistry';
import { navigateToSubTab } from '../../navigation/navigationRef';
import { getHelpReply, type HelpEntry } from '../../lib/helpKnowledgeBase';
import Screen from '../../components/ui/Screen';

interface ChatMessage {
  id: string;
  from: 'user' | 'bot';
  text?: string;
  results?: HelpEntry[];
}

function goToEntry(navigation: any, entry: HelpEntry) {
  const target = getDepartmentEntry(entry.navigateTo!.department);
  useUIStore.getState().setActiveDepartment(entry.navigateTo!.department);
  navigation.getParent()?.navigate('HomeTab');
  // The department stack remounts fresh to its own home/default subTab
  // on a department switch (Phase 7.1, D13) — if the answer points
  // somewhere deeper than that default, a short deferred follow-up push
  // gives the new stack a moment to mount before navigating into it.
  if (entry.navigateTo!.subTab !== target.defaultSubTab) {
    setTimeout(() => navigateToSubTab(entry.navigateTo!.subTab), 80);
  }
}

export default function HelpAssistantScreen() {
  const t = useTheme();
  const navigation = useNavigation<any>();
  const scrollRef = useRef<ScrollView>(null);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      from: 'bot',
      text: 'Ask me anything about the app, a Control Center setting, a department’s pages, or why something got blocked (e.g. "why can’t someone log into mobile").',
    },
  ]);

  const send = () => {
    const q = query.trim();
    if (!q) return;
    const reply = getHelpReply(q, DEPARTMENT_REGISTRY);
    // Direct instruction: confidence-based, never a guessed answer
    // dressed up as certain. 'confident' shows the one clear match with
    // no hedging lead-in; 'weak' softens with "closest thing I found";
    // 'multiple' offers a short pick-list instead of guessing one;
    // 'unsure'/'greeting' are message-only, no cards.
    const leadText =
      reply.kind === 'weak' ? 'The closest thing I found was:' :
      reply.kind === 'multiple' ? 'A few things might be what you mean:' :
      undefined;
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, from: 'user', text: q },
      { id: `b-${Date.now()}`, from: 'bot', text: reply.message ?? leadText, results: reply.results },
    ]);
    setQuery('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  };

  return (
    <Screen scroll={false} padded={false}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.md }}
      >
        {messages.map((m) =>
          m.from === 'user' ? (
            <View key={m.id} style={{ alignSelf: 'flex-end', maxWidth: '82%', backgroundColor: t.colors.accent, borderRadius: t.radius.lg, borderTopRightRadius: 4, padding: t.spacing.md }}>
              <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body14.size, color: t.colors.onAccent }}>{m.text}</Text>
            </View>
          ) : (
            <View key={m.id} style={{ alignSelf: 'flex-start', maxWidth: '88%', flexDirection: 'row', gap: t.spacing.sm }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: t.colors.accentSoft, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                <Bot size={15} color={t.colors.accent} />
              </View>
              <View style={{ flex: 1, gap: t.spacing.sm }}>
                {m.text ? (
                  <View style={{ backgroundColor: t.colors.bgCard, borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.lg, borderTopLeftRadius: 4, padding: t.spacing.md }}>
                    <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>{m.text}</Text>
                  </View>
                ) : null}
                {m.results?.map((r) => (
                  <View key={r.id} style={{ backgroundColor: t.colors.bgCard, borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.lg, padding: t.spacing.md, gap: 4 }}>
                    <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>{r.title}</Text>
                    <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary, lineHeight: 18 }}>{r.answer}</Text>
                    {r.steps && r.steps.length > 0 ? (
                      <View style={{ gap: 3, marginTop: 2 }}>
                        {r.steps.map((step, i) => (
                          <View key={i} style={{ flexDirection: 'row', gap: 6 }}>
                            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.accent }}>{i + 1}.</Text>
                            <Text style={{ flex: 1, fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary, lineHeight: 18 }}>{step}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                    {r.navigateTo ? (
                      <Pressable
                        onPress={() => goToEntry(navigation, r)}
                        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, opacity: pressed ? 0.6 : 1 })}
                      >
                        <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, color: t.colors.accent }}>Go there</Text>
                        <ArrowRight size={12} color={t.colors.accent} />
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          )
        )}
      </ScrollView>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, padding: t.spacing.md, borderTopWidth: 1, borderTopColor: t.colors.border, backgroundColor: t.colors.bgCard }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Ask about a setting, page, or issue…"
          placeholderTextColor={t.colors.textMuted}
          onSubmitEditing={send}
          returnKeyType="send"
          style={{
            flex: 1,
            fontFamily: t.font.regular,
            fontSize: t.type.body14.size,
            color: t.colors.textPrimary,
            backgroundColor: t.colors.bgInput,
            borderRadius: t.radius.pill,
            paddingHorizontal: t.spacing.lg,
            paddingVertical: t.spacing.sm,
          }}
        />
        <Pressable
          onPress={send}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: t.colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Send size={17} color={t.colors.onAccent} />
        </Pressable>
      </View>
    </Screen>
  );
}
