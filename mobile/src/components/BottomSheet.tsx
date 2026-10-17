import React, { type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { colors, radius } from '@/theme';

interface Props { visible: boolean; title?: string; onClose: () => void; children: ReactNode }

export function BottomSheet({ visible, title, onClose, children }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Animated.View entering={FadeIn.duration(200)} style={StyleSheet.absoluteFill}>
          <Pressable style={styles.backdrop} onPress={onClose} />
        </Animated.View>
        <View style={styles.bottom} pointerEvents="box-none">
          <Animated.View entering={SlideInDown.springify().damping(20).stiffness(190)} style={styles.sheet}>
            <View style={styles.grabber} />
            {title ? <Text style={styles.title}>{title}</Text> : null}
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
              {children}
            </ScrollView>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,30,28,0.45)' },
  bottom: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: 20, paddingTop: 10, maxHeight: '88%' },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 14 },
});
