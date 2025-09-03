// components/ChatMessage.tsx

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Message, SuggestedService } from '../types';
import { LinearGradient } from 'expo-linear-gradient';

interface ChatMessageProps {
  message: Message;
  onPressSuggestion?: (svc: SuggestedService) => void;
}

// Lightweight emoji-based icon fallbacks to avoid runtime errors if icon libs are missing
function Icon({ symbol }: { symbol: string }) {
  return <Text style={{ color: '#fff', fontSize: 16 }}>{symbol}</Text>;
}

export default function ChatMessage({ message, onPressSuggestion }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.container, isUser ? styles.containerUser : styles.containerAssistant]}>
      <View style={styles.iconWrapper}>
        {isUser ? <Icon symbol={'👤'} /> : <Icon symbol={'🩺'} />}
      </View>

      {isUser ? (
        <View style={[styles.bubble, styles.bubbleUser]}>
          <Text style={[styles.text, styles.textUser]}>{message.text}</Text>
        </View>
      ) : (
        <LinearGradient
          colors={["#06b6d4", "#3b82f6"]}
          start={[0, 0]}
          end={[1, 1]}
          style={[styles.bubble, styles.bubbleAssistant]}
        >
          <Text style={[styles.text, styles.textAssistant]}>{message.text}</Text>

          {message.suggestedServices && message.suggestedServices.length > 0 && (
            <View style={styles.suggestionsContainer}>
              {message.suggestedServices.map((s) => (
                <View key={s.id} style={styles.suggestionCard}>
                  <View style={styles.suggestionInfo}>
                    <Text style={styles.suggestionTitle}>{s.title}</Text>
                    <Text style={styles.suggestionDesc}>{s.description}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.suggestionAction}
                    onPress={() => onPressSuggestion?.(s)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.suggestionActionText}>Book</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </LinearGradient>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: 8,
    paddingHorizontal: 12
  },
  containerAssistant: {
    justifyContent: 'flex-start'
  },
  containerUser: {
    justifyContent: 'flex-end'
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4338ca',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2
  },
  bubbleAssistant: {
    backgroundColor: 'transparent'
  },
  bubbleUser: {
    backgroundColor: '#111827'
  },
  text: {
    fontSize: 15,
    lineHeight: 20
  },
  textAssistant: {
    color: '#ffffff'
  },
  textUser: {
    color: '#fff'
  },
  suggestionsContainer: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  suggestionCard: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
    marginTop: 6
  },
  suggestionInfo: {
    flex: 1
  },
  suggestionTitle: {
    fontSize: 12,
    fontWeight: 'bold'
  },
  suggestionDesc: {
    fontSize: 10,
    color: '#888'
  },
  suggestionAction: {
    backgroundColor: '#06b6d4',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 6
  },
  suggestionActionText: {
    color: '#fff',
    fontSize: 12
  }
});