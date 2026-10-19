export type Role = 'child' | 'volunteer' | 'teacher' | 'operator'
export interface Person { id: string; role: Role; nickname: string; subtitle: string; avatar: string; interests: string[] }
export interface Pair { id: string; childId: string; volunteerId: string; teacherId: string; channel: 'online' | 'paper'; status: 'active' | 'paused'; startedAt: string; pausedAt?: string; pauseReason?: string }
export interface Letter { id: string; pairId: string; authorId: string; createdBy: string; title: string; body: string; riddleId?: string; replyTo?: string; attachmentId?: string; moderation: 'draft' | 'pending' | 'returned' | 'approved'; moderationNote?: string; createdAt: string; updatedAt: string }
export interface Delivery { letterId: string; printedAt?: string; deliveredAt?: string; readAt?: string }
export interface ReplyTask { id: string; letterId: string; pairId: string; dueAt: string; status: 'awaiting' | 'review' | 'completed' }
export interface Review { id: string; letterId: string; operatorId: string; decision: 'approved' | 'returned'; note: string; createdAt: string }
export interface Followup { id: string; pairId?: string; taskId?: string; kind: 'overdue' | 'help'; status: 'open' | 'resolved'; note: string; resolution?: string; createdAt: string; updatedAt: string }
export interface Attachment { id: string; pairId: string; name: string; type: string; blob: Blob }
export interface Riddle { id: string; question: string; hint: string; answer: string; category: string }
export interface AppState { id: 'main'; version: 1; clock: string; people: Person[]; pairs: Pair[]; letters: Letter[]; deliveries: Delivery[]; tasks: ReplyTask[]; reviews: Review[]; followups: Followup[]; attachments: Attachment[] }
export type Command =
 | { type: 'match'; childId: string; volunteerId: string; teacherId: string; channel: 'online' | 'paper' }
 | { type: 'save-letter'; id?: string; pairId: string; replyTo?: string; title: string; body: string; riddleId?: string; file?: File; removeAttachment?: boolean }
 | { type: 'submit-letter'; id: string }
 | { type: 'review-letter'; id: string; decision: 'approved' | 'returned'; note: string }
 | { type: 'print'; ids: string[] }
 | { type: 'deliver'; ids: string[] }
 | { type: 'read'; id: string }
 | { type: 'pause-pair'; id: string; reason: string }
 | { type: 'resume-pair'; id: string }
 | { type: 'help'; pairId?: string; body: string }
 | { type: 'resolve-followup'; id: string; note: string }
 | { type: 'set-clock'; value: string }
