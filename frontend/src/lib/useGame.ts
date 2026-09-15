import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket, ackPromise } from "./socket";
import { ChatEntry, GameState } from "./game-types";

export function useGame(roomCode: string | undefined) {
  const [state, setState] = useState<GameState | null>(null);
  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [joining, setJoining] = useState(true);
  const joinedRef = useRef(false);

  useEffect(() => {
    if (!roomCode) return;
    const socket = getSocket();
    joinedRef.current = false;
    setJoining(true);
    setConnectionError(null);

    function onGameState(next: GameState) {
      setState(next);
    }
    function onChat(entry: ChatEntry) {
      setChat((prev) => [...prev.slice(-99), entry]);
    }
    function onConnect() {
      if (joinedRef.current) return;
      socket.emit("JOIN_ROOM", { roomCode }, (res: any) => {
        setJoining(false);
        if (res?.ok) {
          joinedRef.current = true;
          if (res.data?.state) setState(res.data.state);
        } else {
          setConnectionError(res?.message ?? "রুমে যোগ দেওয়া যায়নি।");
        }
      });
    }
    function onConnectError(err: Error) {
      setJoining(false);
      setConnectionError(err.message || "সার্ভারের সাথে সংযোগ করা যায়নি।");
    }

    socket.on("GAME_STATE", onGameState);
    socket.on("CHAT_MESSAGE", onChat);
    socket.on("connect", onConnect);
    socket.on("connect_error", onConnectError);

    if (socket.connected) onConnect();
    else socket.connect();

    return () => {
      socket.off("GAME_STATE", onGameState);
      socket.off("CHAT_MESSAGE", onChat);
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
    };
  }, [roomCode]);

  const call = useCallback(
    (event: string, payload: Record<string, unknown> = {}) => {
      const socket = getSocket();
      return ackPromise((ack) => socket.emit(event, { roomCode, ...payload }, ack));
    },
    [roomCode]
  );

  return {
    state,
    chat,
    joining,
    connectionError,
    actions: {
      startGame: () => call("START_GAME"),
      rollDice: () => call("ROLL_DICE"),
      buyProperty: (tileId: string, decision: "yes" | "no") => call("BUY_PROPERTY", { tileId, decision }),
      payRent: () => call("PAY_RENT"),
      payTax: () => call("PAY_TAX"),
      closeCard: () => call("CLOSE_CARD"),
      developProperty: (propertyId: string) => call("DEVELOP_PROPERTY", { propertyId }),
      downgradeProperty: (propertyId: string) => call("DOWNGRADE_PROPERTY", { propertyId }),
      mortgageProperty: (propertyId: string) => call("MORTGAGE_PROPERTY", { propertyId }),
      unmortgageProperty: (propertyId: string) => call("UNMORTGAGE_PROPERTY", { propertyId }),
      jailPay: () => call("JAIL_PAY"),
      jailCard: () => call("JAIL_CARD"),
      jailRoll: () => call("JAIL_ROLL"),
      proposeTrade: (toUserId: string, fromProps: string[], toProps: string[], fromCash: number, toCash: number) =>
        call("TRADE_PROPOSE", { toUserId, fromProps, toProps, fromCash, toCash }),
      acceptTrade: (tradeId: string) => call("TRADE_ACCEPT", { tradeId }),
      rejectTrade: (tradeId: string) => call("TRADE_REJECT", { tradeId }),
      endTurn: () => call("END_TURN"),
      sendChat: (message: string) => call("CHAT_MESSAGE", { message }),
    },
  };
}
