export type Role = 'child' | 'volunteer' | 'teacher' | 'operator'
export type ReportedParty = 'volunteer' | 'teacher' | 'operator' | 'other'
export type DeliveryRoute = 'online' | 'school-paper'
export interface Person { id: string; role: Role; nickname: string; subtitle: string; avatar: string; interests: string[]; teacherId?: string; schoolId?: string; accountStatus?: 'active' | 'pending' | 'disabled'; volunteerApproved?: boolean; guardianConsent?: boolean; permissions?: ('review' | 'safeguarding' | 'administration' | 'independentSafeguarding')[] }
export interface School { id: string; name: string; status: 'active' | 'paused' }
export type TeacherScope = 'status' | 'capture' | 'paper-delivery' | 'protect' | 'school-coordinate'
export interface TeacherAssignment { id: string; schoolId: string; teacherId: string; childId?: string; scope: TeacherScope[]; startsAt: string; endsAt?: string; revokedAt?: string; approvedBy: string }
export interface TimeInterval { start: string; end?: string; kind: 'pause' | 'review'; sourceId: string }
/** channel is retained only to interpret older synthetic records; new routing is on Letter. */
export interface Pair { id: string; childId: string; volunteerId: string; teacherId: string; schoolId?: string; channel: 'online' | 'paper'; status: 'active' | 'paused' | 'ended'; startedAt: string; pausedAt?: string; pauseReason?: string; endedAt?: string; endReason?: string; pauseHistory?: TimeInterval[] }
export interface LetterVersion { revision: number; title: string; body: string; riddleId?: string; attachmentId?: string; manuscriptAssetId?: string; ocrRunId?: string; approvedRenditionId?: string; coveredLetterIds: string[]; submittedAt: string; submittedBy: string }
export interface Letter { id: string; pairId: string; authorId: string; recipientId?: string; createdBy: string; deliveryRoute?: DeliveryRoute; reviewAssigneeId?: string; title: string; body: string; riddleId?: string; replyTo?: string; attachmentId?: string; manuscriptAssetId?: string; ocrRunId?: string; approvedRenditionId?: string; moderation: 'draft' | 'pending' | 'returned' | 'approved'; moderationNote?: string; createdAt: string; updatedAt: string; revision?: number; coveredLetterIds?: string[]; submissionVersions?: LetterVersion[]; childConfirmedAt?: string }
export interface Delivery { letterId: string; printedAt?: string; deliveredAt?: string; readAt?: string; witnessedReadAt?: string; witnessedBy?: string }
export interface DeliveryEvent { id: string; letterId: string; type: 'online-available' | 'print-attempt' | 'printed' | 'handed-to-child' | 'online-read' | 'witnessed-read' | 'delivery-failed'; actorId: string; at: string; note?: string }
export interface ReplyTask { id: string; letterId: string; pairId: string; recipientId?: string; dueAt: string; status: 'awaiting' | 'review' | 'completed'; kind?: 'response' | 'first-letter'; baseDueAt?: string; createdAt?: string; exclusions?: TimeInterval[]; reviewLetterId?: string; completedAt?: string; extensionReason?: string }
export interface Review { id: string; letterId: string; operatorId: string; decision: 'approved' | 'returned'; note: string; createdAt: string; revision?: number }
export interface Followup { id: string; pairId?: string; taskId?: string; kind: 'overdue' | 'help'; status: 'open' | 'resolved'; note: string; resolution?: string; createdAt: string; updatedAt: string; requesterId?: string; ownerId?: string; reportedParty?: ReportedParty; reportedPersonId?: string; nextFollowupAt?: string; history?: { at: string; actorId: string; note: string }[] }
export interface HelpCase { id: string; requesterId: string; pairId?: string; reportedParty: ReportedParty; reportedPersonId?: string; excludedActorIds: string[]; ownerId: string; backupOwnerId?: string; schoolOwnerId?: string; status: 'open' | 'claimed' | 'resolved'; body: string; createdAt: string; updatedAt: string; claimedAt?: string; resolution?: string; history: { at: string; actorId: string; note: string }[] }
export interface ManuscriptAsset { id: string; letterId: string; kind: 'original' | 'approved-redacted'; storagePath?: string; sha256?: string; mimeType: string; width?: number; height?: number; createdAt: string }
/** polygon contains four normalized x,y points in source-image coordinates. */
export interface OcrLine { id: string; pageIndex: number; text: string; confidence?: number; polygon: number[]; uncertain: boolean; correctedText?: string }
export interface OcrRun { id: string; letterId: string; manuscriptAssetId: string; sourceSha256: string; status: 'pending' | 'completed' | 'failed'; humanReviewRequired: true; engine: string; engineVersion: string; startedAt: string; completedAt?: string; error?: string; lines: OcrLine[] }
export interface Attachment { id: string; pairId: string; name: string; type: string; blob?: Blob; ownerId?: string; storagePath?: string; size?: number; sha256?: string; width?: number; height?: number; uploadedAt?: string; deletingAt?: string }
export interface Riddle { id: string; question: string; hint: string; answer: string; category: string }
export interface AppState { id: 'main'; version: 1; clock: string; people: Person[]; schools?: School[]; teacherAssignments?: TeacherAssignment[]; pairs: Pair[]; letters: Letter[]; deliveries: Delivery[]; deliveryEvents?: DeliveryEvent[]; tasks: ReplyTask[]; reviews: Review[]; followups: Followup[]; helpCases?: HelpCase[]; attachments: Attachment[]; manuscriptAssets?: ManuscriptAsset[]; ocrRuns?: OcrRun[] }
export type Command =
 | { type: 'match'; childId: string; volunteerId: string; teacherId: string; channel: 'online' | 'paper' }
 | { type: 'assign-teacher'; schoolId: string; teacherId: string; childId?: string; scope: TeacherScope[]; startsAt: string; endsAt?: string }
 | { type: 'revoke-teacher-assignment'; id: string }
 | { type: 'save-letter'; id?: string; pairId: string; authorId?: string; recipientId?: string; deliveryRoute?: DeliveryRoute; replyTo?: string; title: string; body: string; riddleId?: string; file?: File; attachmentId?: string; removeAttachment?: boolean; expectedRevision?: number }
 | { type: 'submit-letter'; id: string; coveredLetterIds?: string[]; confirmedByChild?: boolean }
 | { type: 'review-letter'; id: string; decision: 'approved' | 'returned'; note: string; transcriptFaithfulConfirmed?: boolean; imagePrivacyConfirmed?: boolean }
 | { type: 'assign-review'; id: string; reviewerId: string }
 | { type: 'release-held-letter'; id: string }
 | { type: 'print'; ids: string[] }
 | { type: 'deliver'; ids: string[] }
 | { type: 'read'; id: string }
 | { type: 'witness-read'; id: string }
 | { type: 'pause-pair'; id: string; reason: string }
 | { type: 'pause-volunteer'; volunteerId: string; reason: string }
 | { type: 'resume-pair'; id: string }
 | { type: 'end-pair'; id: string; reason: string }
 | { type: 'extend-task'; id: string; dueAt: string; reason: string }
 | { type: 'help'; pairId?: string; body: string; reportedParty?: ReportedParty; reportedPersonId?: string }
 | { type: 'claim-help-case'; id: string }
 | { type: 'assign-help-case'; id: string; ownerId: string }
 | { type: 'resolve-help-case'; id: string; note: string }
 | { type: 'resolve-followup'; id: string; note: string; nextFollowupAt?: string }
 | { type: 'assign-followup'; id: string; ownerId: string; nextFollowupAt?: string }
 | { type: 'reopen-followup'; id: string; note: string; nextFollowupAt?: string }
 | { type: 'set-clock'; value: string }
