"use client";

import { useState, useRef, type FormEvent, type KeyboardEvent } from "react";

interface ChatInputProps {
  onSubmit: (text: string) => void;
  onStop: () => void;
  isLoading: boolean;
  isConnected: boolean;
}

export function ChatInput({
  onSubmit,
  onStop,
  isLoading,
  isConnected,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSubmit(input);
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        onSubmit(input);
        setInput("");
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
      }
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  return (
    <div className="border-t border-zinc-800 px-4 py-3">
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            handleInput();
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            isConnected
              ? "Ask about your portfolio, swaps, yields..."
              : "Connect wallet to start chatting"
          }
          disabled={!isConnected}
          rows={1}
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none focus:border-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {isLoading ? (
          <button
            type="button"
            onClick={onStop}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition-colors shrink-0"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim() || !isConnected}
            className="px-4 py-2.5 bg-zinc-100 hover:bg-white text-zinc-900 rounded-xl font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
          >
            Send
          </button>
        )}
      </form>
    </div>
  );
}
