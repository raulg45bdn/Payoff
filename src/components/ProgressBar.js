import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../theme';

/**
 * progress: 0–1 decimal representing completion.
 * height: bar height in px (default 5).
 */
export default function ProgressBar({ progress, height = 5, style }) {
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <View style={[styles.track, { height }, style]}>
      <View style={[styles.fill, { width: `${pct * 100}%`, height }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: '#3A3A3C',
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    // Gradient approximated via two-tone; LinearGradient requires expo-linear-gradient
    // Using safeGreen as fill — gradient added in Phase 2 polish
    backgroundColor: Colors.safeGreen,
    borderRadius: 3,
  },
});
