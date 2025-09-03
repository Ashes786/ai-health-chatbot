// components/MicButton.tsx

import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';

interface MicButtonProps {
  isRecording: boolean;
  isProcessing: boolean;
  autoListen: boolean;
  onPress: () => void;
  onToggleAutoListen?: () => void;
}

function Icon({ symbol, size = 18 }: { symbol: string; size?: number }) {
  return <Text style={{ color: '#fff', fontSize: size }}>{symbol}</Text>;
}

export default function MicButton({ isRecording, isProcessing, autoListen, onPress, onToggleAutoListen }: MicButtonProps) {
  return (
    <View style={styles.wrapper}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[styles.button, isRecording ? styles.buttonRecording : styles.buttonIdle]}>
        {isRecording ? <Icon symbol={'⏹️'} size={24} /> : <Icon symbol={'🎤'} size={24} />}
      </TouchableOpacity>

      <TouchableOpacity onPress={onToggleAutoListen} style={styles.autoBtn}>
        <Icon symbol={'🔁'} size={14} />
        <Text style={[styles.autoText, { color: autoListen ? '#06b6d4' : '#9CA3AF' }]}>{autoListen ? 'Auto' : 'Off'}</Text>
      </TouchableOpacity>

      {isProcessing && <View style={styles.processingDot} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center'
  },
  button: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6
  },
  buttonIdle: {
    backgroundColor: '#4338ca'
  },
  buttonRecording: {
    backgroundColor: '#ef4444'
  },
  autoBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center'
  },
  autoText: {
    marginLeft: 6,
    fontSize: 12
  },
  processingDot: {
    position: 'absolute',
    right: -6,
    top: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F59E0B'
  }
});