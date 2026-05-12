import type { ReactNode } from 'react';

export type Tool = 'brush' | 'eraser';

export type Mode =
  | 'idle'
  | 'click-mask'
  | 'select-similar';

export type ProcessingKind =
  | 'remove'
  | 'prompt'
  | 'click-mask'
  | 'similar'
  | 'encode'
  | null;

export interface HistoryItem {
  id: string;
  type: string;
  time: string;
  icon: ReactNode;
  color: string;
}

export interface Point {
  x: number;
  y: number;
}

export type ApiError =
  | { kind: 'embedding_lost' }
  | { kind: 'network'; message: string }
  | { kind: 'server'; status: number; message: string };
