import type { RoutedIntent } from '../skills/router'

export type SessionStatus = 'waiting' | 'running' | 'clarifying' | 'done' | 'error'

export interface Session {
  threadTs: string
  channelId: string
  intent: RoutedIntent
  /** Đường dẫn file trong /tmp */
  localFilePath: string | null
  /** Đường dẫn file đã copy vào project */
  projectFilePath: string | null
  /** Tất cả messages user gửi trong thread (sau @mention ban đầu) */
  userMessages: string[]
  status: SessionStatus
  createdAt: number
}

// In-memory store — keyed by thread_ts
const store = new Map<string, Session>()

export function createSession(data: Omit<Session, 'userMessages' | 'status' | 'createdAt'>): Session {
  const session: Session = {
    ...data,
    userMessages: [],
    status: 'waiting',
    createdAt: Date.now(),
  }
  store.set(data.threadTs, session)
  return session
}

export function getSession(threadTs: string): Session | undefined {
  return store.get(threadTs)
}

export function appendMessage(threadTs: string, message: string): void {
  const session = store.get(threadTs)
  if (session) {
    session.userMessages.push(message)
  }
}

export function updateStatus(threadTs: string, status: SessionStatus): void {
  const session = store.get(threadTs)
  if (session) {
    session.status = status
  }
}

export function deleteSession(threadTs: string): void {
  store.delete(threadTs)
}

export function hasActiveSession(threadTs: string): boolean {
  const session = store.get(threadTs)
  return !!session && (session.status === 'waiting' || session.status === 'clarifying')
}
