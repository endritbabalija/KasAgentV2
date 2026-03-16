"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";

interface CardErrorBoundaryProps {
  toolName: string;
  children: ReactNode;
}

interface CardErrorBoundaryState {
  error: Error | null;
}

export class CardErrorBoundary extends Component<CardErrorBoundaryProps, CardErrorBoundaryState> {
  constructor(props: CardErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): CardErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[CardErrorBoundary] ${this.props.toolName}:`, error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="bg-red-950/30 border border-red-800/50 rounded-xl p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">
            {this.props.toolName}
          </div>
          <p className="text-sm text-red-400 mb-2">
            Failed to render this card.
          </p>
          <button
            onClick={this.reset}
            className="text-xs text-red-400 hover:text-red-300 underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
