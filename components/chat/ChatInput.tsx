"use client";

import { useState, useRef, type FormEvent, type KeyboardEvent } from "react";
import { Square, ArrowUp } from "lucide-react";

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
    <div className="shrink-0 px-3 sm:px-4 pb-4 pt-2">
      <form
        onSubmit={handleSubmit}
        className="relative flex items-end gap-2 max-w-3xl mx-auto bg-zinc-900/80 border border-zinc-700/60 rounded-2xl px-3 py-2 backdrop-blur-sm shadow-[0_-4px_24px_rgba(0,0,0,0.3)]"
      >
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
          className="flex-1 bg-transparent px-2 py-1.5 text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        />
        {isLoading ? (
          <button
            type="button"
            onClick={onStop}
            className="p-2 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-colors shrink-0"
            aria-label="Stop"
          >
            <Square className="w-4 h-4 fill-current" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim() || !isConnected}
            className="p-2 bg-zinc-100 hover:bg-white text-zinc-900 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
            aria-label="Send"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        )}
      </form>
    </div>
  );
}
