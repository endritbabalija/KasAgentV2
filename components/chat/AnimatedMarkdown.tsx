"use client";

import { useAnimatedText } from "@/hooks/useAnimatedText";
import { MarkdownRenderer } from "./MarkdownRenderer";

/**
 * Wraps MarkdownRenderer with character-by-character animation.
 * Only mounted while the assistant is actively streaming — unmounts
 * when streaming ends, at which point ChatMessage switches to plain MarkdownRenderer.
 */
export function AnimatedMarkdown({ content }: { content: string }) {
  const animatedContent = useAnimatedText(content);
  return <MarkdownRenderer content={animatedContent} />;
}
