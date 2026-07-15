import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const RealtimeContext = createContext(null);

/**
 * Connects to /api/ws with the user's JWT. Reconnects with exponential backoff.
 * Exposes: online, subscribe(event, handler), send(event, data)
 */
export function RealtimeProvider({ children }) {
    const { user } = useAuth();
    const wsRef = useRef(null);
    const handlersRef = useRef(new Map());
    const reconnectAttemptRef = useRef(0);
    const reconnectTimerRef = useRef(null);
    const [online, setOnline] = useState(false);

    const connect = useCallback(() => {
        if (!user) return;
        const token = localStorage.getItem("token");
        if (!token) return;
        const httpBase = process.env.REACT_APP_BACKEND_URL || "";
        const wsUrl = httpBase.replace(/^http/, "ws") + `/api/ws?token=${encodeURIComponent(token)}`;
        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                setOnline(true);
                reconnectAttemptRef.current = 0;
            };
            ws.onmessage = (ev) => {
                try {
                    const { event, data } = JSON.parse(ev.data);
                    // fire subscribers
                    const subs = handlersRef.current.get(event) || [];
                    subs.forEach((h) => { try { h(data); } catch { /* ignore */ } });
                    // default: show notification toast
                    if (event === "notification" && data?.text) {
                        toast(data.text, { description: data.type ? `إشعار جديد · ${data.type}` : undefined });
                    }
                } catch { /* ignore parse errors */ }
            };
            ws.onclose = () => {
                setOnline(false);
                wsRef.current = null;
                // exponential backoff, max 30s
                const delay = Math.min(30000, 1000 * Math.pow(2, reconnectAttemptRef.current));
                reconnectAttemptRef.current += 1;
                reconnectTimerRef.current = setTimeout(connect, delay);
            };
            ws.onerror = () => { /* let onclose handle reconnect */ };
        } catch { /* ignore */ }
    }, [user]);

    useEffect(() => {
        if (!user) return;
        connect();
        return () => {
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            if (wsRef.current) { try { wsRef.current.close(); } catch { /* ignore */ } }
        };
    }, [user, connect]);

    const subscribe = useCallback((event, handler) => {
        const list = handlersRef.current.get(event) || [];
        list.push(handler);
        handlersRef.current.set(event, list);
        return () => {
            const cur = handlersRef.current.get(event) || [];
            handlersRef.current.set(event, cur.filter((h) => h !== handler));
        };
    }, []);

    const send = useCallback((event, data) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return false;
        try {
            ws.send(JSON.stringify({ event, data }));
            return true;
        } catch { return false; }
    }, []);

    return (
        <RealtimeContext.Provider value={{ online, subscribe, send }}>
            {children}
        </RealtimeContext.Provider>
    );
}

export function useRealtime() {
    const ctx = useContext(RealtimeContext);
    return ctx || { online: false, subscribe: () => () => {}, send: () => false };
}
