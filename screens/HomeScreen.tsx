import React, { useRef, useState } from 'react';
import { View, SafeAreaView, StyleSheet, FlatList, TextInput, TouchableOpacity, Text, KeyboardAvoidingView, Platform } from 'react-native';
import ChatMessage from '../components/ChatMessage';
import MicButton from '../components/MicButton';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';
import { Message } from '../types';

export default function HomeScreen() {
  const {
    messages,
    isRecording,
    isProcessing,
    autoListen,
    startListening,
    stopListening,
    sendText,
    toggleAutoListen,
    executeSuggestedService
  } = useVoiceAssistant();

  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);

  const onMicPress = async () => {
    if (isRecording) {
      await stopListening();
    } else {
      await startListening();
    }
  };

  const handleSend = async () => {
    if (!text.trim()) return;
    await sendText(text.trim());
    setText('');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Fitwell — Voice Assistant</Text>
        <Text style={styles.subtitle}>Speak naturally. I can help book doctors, labs, or medicines.</Text>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item: Message) => item.id}
        renderItem={({ item }) => <ChatMessage message={item} onPressSuggestion={executeSuggestedService} />}
        contentContainerStyle={styles.messages}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <View style={styles.footer}>
          <TextInput
            placeholder="Type a message"
            placeholderTextColor="#9CA3AF"
            value={text}
            onChangeText={setText}
            style={styles.input}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />

          <View style={styles.controls}>
            <MicButton
              isRecording={isRecording}
              isProcessing={isProcessing}
              autoListen={autoListen}
              onPress={onMicPress}
              onToggleAutoListen={toggleAutoListen}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700'
  },
  subtitle: {
    color: '#9CA3AF',
    marginTop: 6
  },
  messages: {
    paddingHorizontal: 8,
    paddingBottom: 16
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center'
  },
  input: {
    flex: 1,
    backgroundColor: '#0b1220',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: 12
  },
  controls: {
    width: 96,
    alignItems: 'center'
  }
});