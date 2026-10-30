"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessageDTO } from "@/lib/chat-shared";

type SSEEvent =
 | { type: "messages"; items: ChatMessageDTO[] }
 | { type: "removed"; ids: string[] };

export function useChatStream(
 initialMessages: ChatMessageDTO[],
 initialServerTime: string,
) {
 const [messages, setMessages] = useState<ChatMessageDTO[]>(() => initialMessages);
 const sinceRef = useRef(initialServerTime);
 const messagesRef = useRef(initialMessages);
 const esRef = useRef<EventSource | null>(null);
 const reconnectRef = useRef(0);
 const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

 useEffect(() => {
 function connect() {
 const params = new URLSearchParams();
 const last = messagesRef.current[messagesRef.current.length - 1];
 if (last?.id) params.set("after", last.id);
 if (sinceRef.current) params.set("since", sinceRef.current);

 const es = new EventSource(`/api/chat/stream?${params.toString()}`);
 esRef.current = es;

 es.onmessage = (evt) => {
 try {
 const data = JSON.parse(evt.data) as SSEEvent;
 if (data.type === "messages" && data.items.length > 0) {
 setMessages((prev) => {
 const next = [...prev, ...data.items];
 messagesRef.current = next;
 return next;
 });
 }
 if (data.type === "removed" && data.ids.length > 0) {
 const removed = new Set(data.ids);
 setMessages((prev) => {
 const next = prev.filter((m) => !removed.has(m.id));
 messagesRef.current = next;
 return next;
 });
 }
 } catch { /* ignore malformed event */ }
 };

 es.onerror = () => {
 es.close();
 esRef.current = null;
 const attempt = reconnectRef.current + 1;
 reconnectRef.current = attempt;
 const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
 reconnectTimerRef.current = setTimeout(connect, delay);
 };
 }

 connect();

 return () => {
 if (esRef.current) {
 esRef.current.close();
 esRef.current = null;
 }
 if (reconnectTimerRef.current) {
 clearTimeout(reconnectTimerRef.current);
 reconnectTimerRef.current = null;
 }
 };
 }, []); // run once — refs keep the latest without re-subscribing

 return {
 messages,
 setMessages,
 };
}
