export type Role = 'child' | 'volunteer' | 'teacher' | 'operator'
export interface Person { id: string; role: Role; nickname: string; subtitle: string; avatar: string; interests: string[]; teacherId?: string; accountStatus?: 'active' | 'pending' | 'disabled'; volunteerApproved?: boolean; guardianConsent?: boolean; permissions?: ('review' | 'safeguarding' | 'administration')[] }
export interface TimeInterval { start: string; end?: string; kind: 'pause' | 'review'; sourceId: string }
export interface Pair { id: string; childId: string; volunteerId: string; teacherId: string; channel: 'online' | 'paper'; status: 'active' | 'paused' | 'ended'; startedAt: string; pausedAt?: string; pauseReason?: string; endedAt?: string; endReason?: string; pauseHistory?: TimeInterval[] }
export interface LetterVersion { revision: number; title: string; body: string; riddleId?: string; attachmentId?: string; coveredLetterIds: string[]; submittedAt: string; submittedBy: string }
export interface Letter { id: string; pairId: string; authorId: string; recipientId?: string; createdBy: string; title: string; body: string; riddleId?: string; replyTo?: string; attachmentId?: string; moderation: 'draft' | 'pending' | 'returned' | 'approved'; moderationNote?: string; createdAt: string; updatedAt: string; revision?: number; coveredLetterIds?: string[]; submissionVersions?: LetterVersion[]; childConfirmedAt?: string }
export interface Delivery { letterId: string; printedAt?: string; deliveredAt?: string; readAt?: string }
export interface ReplyTask { id: string; letterId: string; pairId: string; recipientId?: string; dueAt: string; status: 'awaiting' | 'review' | 'completed'; kind?: 'response' | 'first-letter'; baseDueAt?: string; createdAt?: string; exclusions?: TimeInterval[]; reviewLetterId?: string; completedAt?: string; extensionReason?: string }
export interface Review { id: string; letterId: string; operatorId: string; decision: 'approved' | 'returned'; note: string; createdAt: string; revision?: number }
export interface Followup { id: string; pairId?: string; taskId?: string; kind: 'overdue' | 'help'; status: 'open' | 'resolved'; note: string; resolution?: string; createdAt: string; updatedAt: string; requesterId?: string; ownerId?: string; nextFollowupAt?: string; history?: { at: string; actorId: string; note: string }[] }
export interface Attachment { id: string; pairId: string; name: string; type: string; blob?: Blob; ownerId?: string; storagePath?: string; size?: number; uploadedAt?: string; deletingAt?: string }
export interface Riddle { id: string; question: string; hint: string; answer: string; category: string }
export interface AppState { id: 'main'; version: 1; clock: string; people: Person[]; pairs: Pair[]; letters: Letter[]; deliveries: Delivery[]; tasks: ReplyTask[]; reviews: Review[]; followups: Followup[]; attachments: Attachment[] }
export type Command =
 | { type: 'match'; childId: string; volunteerId: string; teacherId: string; channel: 'online' | 'paper' }
 | { type: 'save-letter'; id?: string; pairId: string; authorId?: string; recipientId?: string; replyTo?: string; title: string; body: string; riddleId?: string; file?: File; attachmentId?: string; removeAttachment?: boolean; expectedRevision?: number }
 | { type: 'submit-letter'; id: string; coveredLetterIds?: string[]; confirmedByChild?: boolean }
 | { type: 'review-letter'; id: string; decision: 'approved' | 'returned'; note: string }
 | { type: 'print'; ids: string[] }
 | { type: 'deliver'; ids: string[] }
 | { type: 'read'; id: string }
 | { type: 'pause-pair'; id: string; reason: string }
 | { type: 'resume-pair'; id: string }
 | { type: 'end-pair'; id: string; reason: string }
 | { type: 'extend-task'; id: string; dueAt: string; reason: string }
 | { type: 'help'; pairId?: string; body: string }
 | { type: 'resolve-followup'; id: string; note: string; nextFollowupAt?: string }
 | { type: 'assign-followup'; id: string; ownerId: string; nextFollowupAt?: string }
 | { type: 'reopen-followup'; id: string; note: string; nextFollowupAt?: string }
 | { type: 'set-clock'; value: string }
