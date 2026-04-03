// mobile-app/app/notifications.tsx
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors } from '@/constants/Colours';
import { fetchApi } from '@/services/api';

interface NotificationItem {
  notification_id: string;
  child_name: string;
  message: string;
  status: string;
  created_at: string | null;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const response = await fetchApi('/notifications');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [])
  );

  const handleDismiss = async (id: string) => {
    try {
      const response = await fetchApi(`/notifications/${id}/dismiss`, { method: 'PATCH' });
      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.notification_id !== id));
      }
    } catch (e) {
      console.error('Failed to dismiss', e);
    }
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return '';
    const date = new Date(iso);
    const diffMs = new Date().getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const activeNotifications = notifications.filter(n => n.status !== 'dismissed');
  const dismissedCount = notifications.filter(n => n.status === 'dismissed').length;

  const renderNotification = ({ item }: { item: NotificationItem }) => (
    <View style={styles.notificationCard}>
      <View style={styles.notificationIcon}>
        <Ionicons name="notifications" size={20} color={Colors.electricBlue} />
      </View>

      <View style={styles.notificationContent}>
        <Text style={styles.childName}>{item.child_name}</Text>
        <Text style={styles.message}>{item.message}</Text>
        <Text style={styles.time}>{formatTime(item.created_at)}</Text>
      </View>

      <TouchableOpacity
        style={styles.dismissButton}
        onPress={() => handleDismiss(item.notification_id)}
        activeOpacity={0.7}
      >
        <Ionicons name="close-circle" size={24} color={Colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={20} color={Colors.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.electricBlue} />
        </View>
      ) : activeNotifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconRing}>
            <Ionicons name="notifications-off-outline" size={40} color={Colors.textSecondary} />
          </View>
          <Text style={styles.emptyTitle}>All clear!</Text>
          <Text style={styles.emptySubtitle}>
            When your children ping you for money, it will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={activeNotifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.notification_id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            dismissedCount > 0 ? (
              <Text style={styles.dismissedLabel}>
                {dismissedCount} dismissed notification{dismissedCount !== 1 ? 's' : ''}
              </Text>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.deepNavy,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  headerBack: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.glassCard,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: Colors.textWhite,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 120,
  },

  // Notification card
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.glassCard,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  notificationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(77,143,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  notificationContent: {
    flex: 1,
  },
  childName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textWhite,
    marginBottom: 2,
  },
  message: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  time: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  dismissButton: {
    padding: 6,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 14,
  },
  emptyIconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.glassCard,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  dismissedLabel: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 12,
    letterSpacing: 0.3,
  },
});
