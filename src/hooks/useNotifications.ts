"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/types";

export function useNotifications() {
  const supabase = createClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("is_read")                        // unread first
      .order("created_at", { ascending: false })
      .limit(100);
    if (data) setNotifications(data as Notification[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchNotifications();

    // Real-time: instant updates on any change to notifications table
    const channel = supabase
      .channel("notifications-global")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications" },
        (payload) => {
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === (payload.new as Notification).id
                ? (payload.new as Notification)
                : n,
            ),
          );
        },
      )
      .subscribe();

    channelRef.current = channel;

    // 5-minute fallback refresh in case real-time drops
    refreshTimerRef.current = setInterval(() => { void fetchNotifications(); }, 5 * 60 * 1000);

    return () => {
      void supabase.removeChannel(channel);
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);
    if (!error) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .in("id", unreadIds);

    if (!error) {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    }
  }, [notifications]);

  const getUnreadCount = useCallback(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications],
  );

  return {
    notifications,
    loading,
    unreadCount: getUnreadCount(),
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  };
}
