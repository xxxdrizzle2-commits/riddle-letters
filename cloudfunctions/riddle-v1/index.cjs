"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// index.ts
var index_exports = {};
__export(index_exports, {
  activationMain: () => activationMain,
  main: () => main,
  maintenanceMain: () => maintenanceMain
});
module.exports = __toCommonJS(index_exports);
var import_node_crypto2 = require("node:crypto");
var import_sharp = __toESM(require("sharp"), 1);
var import_manager_node = __toESM(require("@cloudbase/manager-node"), 1);

// core.ts
var import_node_crypto = require("node:crypto");

// ../src/domain.ts
var DAY = 864e5;
var riddles = [
  { id: "r1", question: "\u5343\u6761\u7EBF\uFF0C\u4E07\u6761\u7EBF\uFF0C\u843D\u5230\u6C34\u91CC\u770B\u4E0D\u89C1\u3002", hint: "\u5E26\u4E0A\u5C0F\u4F1E\u53BB\u627E\u5B83\u3002", answer: "\u96E8", category: "\u5927\u81EA\u7136" },
  { id: "r2", question: "\u5C0F\u5C0F\u4E00\u5EA7\u6865\uFF0C\u96E8\u540E\u5929\u4E0A\u98D8\u3002", hint: "\u5B83\u6709\u597D\u51E0\u79CD\u989C\u8272\u3002", answer: "\u5F69\u8679", category: "\u5927\u81EA\u7136" },
  { id: "r3", question: "\u767D\u5929\u8EB2\u8D77\u6765\uFF0C\u591C\u665A\u4EAE\u6676\u6676\u3002", hint: "\u62AC\u5934\u770B\u770B\u6674\u6717\u7684\u591C\u7A7A\u3002", answer: "\u661F\u661F", category: "\u5927\u81EA\u7136" },
  { id: "r4", question: "\u4E00\u53EA\u5C0F\u8239\u4E24\u5934\u5C16\uFF0C\u767D\u5929\u4E0D\u89C1\u591C\u91CC\u73B0\u3002", hint: "\u5B83\u7684\u6837\u5B50\u6BCF\u5929\u6709\u4E00\u70B9\u53D8\u5316\u3002", answer: "\u6708\u4EAE", category: "\u5927\u81EA\u7136" },
  { id: "r5", question: "\u6709\u9762\u6CA1\u6709\u53E3\uFF0C\u6709\u811A\u6CA1\u6709\u624B\uFF0C\u867D\u7136\u56DB\u53EA\u811A\uFF0C\u81EA\u5DF1\u4E0D\u4F1A\u8D70\u3002", hint: "\u4F60\u53EF\u4EE5\u5750\u5728\u5B83\u65C1\u8FB9\u5199\u4FE1\u3002", answer: "\u684C\u5B50", category: "\u8EAB\u8FB9\u7269\u54C1" },
  { id: "r6", question: "\u5C0F\u5C0F\u8EAB\u4F53\u7A7F\u7EFF\u8863\uFF0C\u8F7B\u8F7B\u4E00\u8DF3\u5230\u7530\u91CC\uFF0C\u5531\u8D77\u6B4C\u6765\u5471\u5471\u5471\u3002", hint: "\u5B83\u662F\u7530\u91CC\u7684\u5C0F\u5E2E\u624B\u3002", answer: "\u9752\u86D9", category: "\u5C0F\u52A8\u7269" },
  { id: "r7", question: "\u8FDC\u770B\u50CF\u628A\u4F1E\uFF0C\u8FD1\u770B\u662F\u4E00\u56E2\uFF0C\u96E8\u540E\u5192\u51FA\u5934\uFF0C\u957F\u5728\u6811\u6839\u65C1\u3002", hint: "\u91CE\u5916\u9047\u5230\u5B83\uFF0C\u53EF\u4E0D\u80FD\u968F\u4FBF\u91C7\u6765\u5403\u3002", answer: "\u8611\u83C7", category: "\u5927\u81EA\u7136" },
  { id: "r8", question: "\u8584\u8584\u4E00\u7247\u7EB8\uFF0C\u88C5\u7740\u8BB8\u591A\u8BDD\uFF0C\u8D8A\u8FC7\u5C71\u548C\u6C34\uFF0C\u8D70\u5230\u670B\u53CB\u5BB6\u3002", hint: "\u6211\u4EEC\u6B63\u5728\u7528\u5B83\u5206\u4EAB\u5C0F\u53D1\u73B0\u3002", answer: "\u4FE1", category: "\u8EAB\u8FB9\u7269\u54C1" },
  { id: "r9", question: "\u4E00\u6735\u82B1\u513F\u771F\u5947\u602A\uFF0C\u6674\u5929\u4E0D\u5F00\u96E8\u5929\u5F00\u3002", hint: "\u5B83\u5E2E\u4F60\u6321\u4F4F\u96E8\u6EF4\u3002", answer: "\u96E8\u4F1E", category: "\u8EAB\u8FB9\u7269\u54C1" },
  { id: "r10", question: "\u5C0F\u5C0F\u8239\u513F\u6C34\u4E2D\u6E38\uFF0C\u5C3E\u5DF4\u6447\u6447\u70B9\u70B9\u5934\u3002", hint: "\u5B83\u7528\u9CC3\u547C\u5438\u3002", answer: "\u9C7C", category: "\u5C0F\u52A8\u7269" },
  { id: "r11", question: "\u8EAB\u7A7F\u82B1\u8863\u88F3\uFF0C\u7231\u5728\u82B1\u95F4\u5FD9\uFF0C\u98DE\u6765\u53C8\u98DE\u53BB\uFF0C\u7FC5\u8180\u50CF\u82B1\u74E3\u3002", hint: "\u5B83\u5C0F\u65F6\u5019\u5E38\u5E38\u662F\u4E00\u6761\u6BDB\u6BDB\u866B\u3002", answer: "\u8774\u8776", category: "\u5C0F\u52A8\u7269" },
  { id: "r12", question: "\u6CA1\u811A\u4E5F\u4F1A\u8DD1\uFF0C\u6CA1\u5634\u4E5F\u4F1A\u53EB\uFF0C\u8D70\u8FC7\u6811\u6797\u65F6\uFF0C\u6811\u53F6\u628A\u624B\u62DB\u3002", hint: "\u95ED\u4E0A\u773C\u775B\uFF0C\u4F60\u4E5F\u80FD\u611F\u89C9\u5230\u5B83\u3002", answer: "\u98CE", category: "\u5927\u81EA\u7136" }
];
var fail = (message) => {
  throw new Error(message);
};
function ensure(condition, message) {
  if (!condition) fail(message);
}
var uid = (prefix) => `${prefix}-${crypto.randomUUID()}`;
var addDays = (iso, days) => new Date(Date.parse(iso) + days * DAY).toISOString();
var hasPermission = (actor, permission) => actor.role === "operator" && (!actor.permissions || actor.permissions.includes(permission));
function recipientForLetter(state, letter) {
  const pair = state.pairs.find((p) => p.id === letter.pairId);
  return letter.recipientId ?? (pair ? letter.authorId === pair.childId ? pair.volunteerId : pair.childId : void 0);
}
function normalizeState(previous) {
  const state = structuredClone(previous);
  for (const letter of state.letters) {
    letter.recipientId ??= recipientForLetter(state, letter);
    letter.revision ??= 0;
    letter.submissionVersions ??= [];
    letter.coveredLetterIds ??= letter.replyTo ? [letter.replyTo] : [];
    if (letter.moderation !== "draft" && !letter.submissionVersions.length) letter.submissionVersions.push({ revision: letter.revision, title: letter.title, body: letter.body, riddleId: letter.riddleId, attachmentId: letter.attachmentId, coveredLetterIds: [...letter.coveredLetterIds], submittedAt: letter.updatedAt, submittedBy: letter.createdBy });
  }
  for (const task of state.tasks) {
    const letter = state.letters.find((l) => l.id === task.letterId);
    task.recipientId ??= letter ? recipientForLetter(state, letter) : state.pairs.find((p) => p.id === task.pairId)?.volunteerId;
    task.kind ??= "response";
    task.baseDueAt ??= task.dueAt;
    task.createdAt ??= state.deliveries.find((d) => d.letterId === task.letterId)?.deliveredAt ?? state.clock;
    task.exclusions ??= [];
  }
  for (const pair of state.pairs) {
    pair.pauseHistory ??= [];
    if (pair.status === "paused" && pair.pausedAt && !pair.pauseHistory.some((i) => !i.end)) pair.pauseHistory.push({ start: pair.pausedAt, kind: "pause", sourceId: pair.id });
  }
  return state;
}
function canReadLetter(state, actor, letter) {
  if (actor.accountStatus === "disabled") return false;
  if (letter.authorId === actor.id) return true;
  if (actor.role === "operator") return hasPermission(actor, "review") && letter.moderation !== "draft";
  const pair = state.pairs.find((p) => p.id === letter.pairId);
  if (!pair) return false;
  if (actor.role === "teacher" && actor.id === pair.teacherId) {
    return letter.createdBy === actor.id || pair.channel === "paper" && letter.moderation === "approved";
  }
  return recipientForLetter(state, letter) === actor.id && letter.moderation === "approved" && !!state.deliveries.find((d) => d.letterId === letter.id)?.deliveredAt;
}
function visibleLetters(state, actor) {
  return state.letters.filter((l) => canReadLetter(state, actor, l)).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}
function scopeState(previous, actorId) {
  const state = normalizeState(previous);
  const actor = state.people.find((p) => p.id === actorId);
  ensure(actor && actor.accountStatus !== "disabled", "\u8D26\u53F7\u4E0D\u53EF\u7528\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55\u6216\u8054\u7CFB\u8D1F\u8D23\u8001\u5E08\u3002");
  const operator2 = actor.role === "operator";
  const administered = hasPermission(actor, "administration");
  const reviewPairs = new Set(hasPermission(actor, "review") ? state.letters.filter((l) => l.moderation !== "draft").map((l) => l.pairId) : []);
  const helpPairs = new Set(hasPermission(actor, "safeguarding") ? state.followups.filter((f) => f.kind === "help").map((f) => f.pairId) : []);
  state.pairs = state.pairs.filter((p) => administered || reviewPairs.has(p.id) || helpPairs.has(p.id) || !operator2 && (p.childId === actorId || p.volunteerId === actorId || p.teacherId === actorId));
  const relatedIds = /* @__PURE__ */ new Set([actorId, ...state.pairs.flatMap((p) => [p.childId, p.volunteerId, p.teacherId])]);
  state.people = state.people.filter((p) => administered || relatedIds.has(p.id) || actor.role === "teacher" && p.teacherId === actorId || hasPermission(actor, "safeguarding") && state.followups.some((f) => f.kind === "help" && f.requesterId === p.id));
  state.letters = visibleLetters(state, actor).map((letter) => {
    if (letter.authorId === actorId || letter.createdBy === actorId || hasPermission(actor, "review")) return letter;
    return { ...letter, submissionVersions: [], moderationNote: void 0, coveredLetterIds: [] };
  });
  const letterIds = new Set(state.letters.map((l) => l.id));
  const pairIds = new Set(state.pairs.map((p) => p.id));
  state.deliveries = state.deliveries.filter((d) => letterIds.has(d.letterId));
  state.tasks = state.tasks.filter((t) => pairIds.has(t.pairId) && (administered || t.recipientId === actorId || actor.role === "teacher" && state.pairs.some((p) => p.id === t.pairId && p.channel === "paper" && t.recipientId === p.childId)));
  state.reviews = state.reviews.filter((r) => state.letters.some((l) => l.id === r.letterId && (l.authorId === actorId || l.createdBy === actorId || hasPermission(actor, "review"))));
  state.followups = state.followups.filter((f) => f.kind === "help" ? f.requesterId === actorId || hasPermission(actor, "safeguarding") : operator2 && hasPermission(actor, "administration"));
  const attachmentIds = new Set(state.letters.flatMap((l) => [l.attachmentId, ...(l.submissionVersions ?? []).map((v) => v.attachmentId)]).filter(Boolean));
  state.attachments = state.attachments.filter((a) => attachmentIds.has(a.id));
  return state;
}
function unionDuration(intervals, now, from) {
  const start = Date.parse(from), end = Date.parse(now);
  const sorted = intervals.map((i) => [Math.max(start, Date.parse(i.start)), Math.min(end, Date.parse(i.end ?? now))]).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
  let total = 0, previousEnd = start;
  for (const [a, b] of sorted) {
    total += Math.max(0, b - Math.max(a, previousEnd));
    previousEnd = Math.max(previousEnd, b);
  }
  return total;
}
function refreshDeadlines(state) {
  for (const task of state.tasks) {
    if (task.status === "completed") continue;
    const pair = state.pairs.find((p) => p.id === task.pairId);
    const duration = unionDuration([...task.exclusions ?? [], ...pair?.pauseHistory ?? []], state.clock, task.createdAt ?? state.clock);
    task.dueAt = new Date(Date.parse(task.baseDueAt ?? task.dueAt) + duration).toISOString();
  }
}
function isOverdue(state, task) {
  return task.status === "awaiting" && state.pairs.find((p) => p.id === task.pairId)?.status === "active" && Date.parse(state.clock) > Date.parse(task.dueAt);
}
function deliver(state, letter) {
  const pair = state.pairs.find((p) => p.id === letter.pairId);
  if (pair.status !== "active") return;
  let delivery = state.deliveries.find((d) => d.letterId === letter.id);
  if (!delivery) {
    delivery = { letterId: letter.id };
    state.deliveries.push(delivery);
  }
  if (delivery.deliveredAt) return;
  delivery.deliveredAt = state.clock;
  const recipientId = recipientForLetter(state, letter);
  if (!state.tasks.some((t) => t.letterId === letter.id)) {
    const dueAt = addDays(state.clock, recipientId === pair.childId ? 14 : 7);
    state.tasks.push({ id: `task-${letter.id}`, letterId: letter.id, pairId: pair.id, recipientId, dueAt, baseDueAt: dueAt, createdAt: state.clock, status: "awaiting", kind: "response", exclusions: [] });
  }
}
function reconcileFollowups(state) {
  refreshDeadlines(state);
  const grouped = /* @__PURE__ */ new Set();
  for (const task of state.tasks.filter((t) => isOverdue(state, t)).sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))) {
    const key = `${task.pairId}:${task.recipientId}`;
    if (grouped.has(key)) continue;
    grouped.add(key);
    const related = state.followups.filter((f) => f.kind === "overdue" && f.pairId === task.pairId && state.tasks.some((t) => t.id === f.taskId && t.recipientId === task.recipientId));
    const open = related.find((f) => f.status === "open");
    const existing = open ?? related.find((f) => f.status === "resolved" && state.tasks.some((t) => t.id === f.taskId && t.status !== "completed"));
    if (!existing) state.followups.push({ id: uid("overdue"), pairId: task.pairId, taskId: task.id, kind: "overdue", status: "open", note: "\u56DE\u4FE1\u6682\u672A\u6536\u5230\u3002\u8BF7\u5148\u4E86\u89E3\u4F19\u4F34\u7684\u8FD1\u51B5\u4E0E\u6536\u53D1\u60C5\u51B5\uFF0C\u6E29\u548C\u8DDF\u8FDB\u3002", ownerId: state.people.find((p) => hasPermission(p, "administration"))?.id, createdAt: state.clock, updatedAt: state.clock });
    else if (existing.status === "open" && existing.taskId !== task.id) {
      existing.taskId = task.id;
      existing.updatedAt = state.clock;
    } else if (existing.status === "resolved" && existing.nextFollowupAt && Date.parse(state.clock) >= Date.parse(existing.nextFollowupAt)) {
      existing.status = "open";
      existing.updatedAt = state.clock;
      existing.taskId = task.id;
    }
  }
  for (const followup of state.followups.filter((f) => f.kind === "overdue" && f.status === "open")) {
    const target = state.tasks.find((t) => t.id === followup.taskId);
    if (target && (target.status === "completed" || !state.tasks.some((t) => t.pairId === target.pairId && t.recipientId === target.recipientId && t.status !== "completed"))) {
      followup.status = "resolved";
      followup.resolution = "\u5F85\u56DE\u5E94\u7684\u4FE1\u4EF6\u5DF2\u5B8C\u6210\u3002";
      followup.updatedAt = state.clock;
    }
  }
}
function refreshState(previous, clock = previous.clock) {
  const state = normalizeState(previous);
  ensure(Number.isFinite(Date.parse(clock)), "\u5F53\u524D\u65F6\u95F4\u65E0\u6548\u3002");
  state.clock = clock;
  reconcileFollowups(state);
  return state;
}
function reduceCommand(previous, actorId, command, options = {}) {
  const state = normalizeState(previous);
  const actor = state.people.find((p) => p.id === actorId);
  ensure(actor, "\u8EAB\u4EFD\u4E0D\u5B58\u5728\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55\u3002");
  ensure(actor.accountStatus !== "disabled" && (!options.formal || actor.accountStatus === "active"), "\u8D26\u53F7\u5C1A\u672A\u83B7\u5F97\u53C2\u4E0E\u6743\u9650\u3002");
  const pairById = (id) => state.pairs.find((p) => p.id === id) ?? fail("\u8FD9\u7EC4\u966A\u4F34\u5173\u7CFB\u4E0D\u5B58\u5728\u3002");
  const letterById = (id) => state.letters.find((l) => l.id === id) ?? fail("\u8FD9\u5C01\u4FE1\u4E0D\u5B58\u5728\u3002");
  const active = (id) => {
    const pair = pairById(id);
    ensure(pair.status === "active", pair.status === "ended" ? "\u8FD9\u7EC4\u966A\u4F34\u5DF2\u7ECF\u7ED3\u675F\u3002" : "\u8FD9\u7EC4\u966A\u4F34\u6B63\u5728\u6682\u505C\uFF0C\u6062\u590D\u540E\u518D\u7EE7\u7EED\u64CD\u4F5C\u3002");
    return pair;
  };
  const operator2 = (permission = "administration") => ensure(hasPermission(actor, permission), "\u8FD9\u9879\u64CD\u4F5C\u9700\u8981\u83B7\u5F97\u76F8\u5E94\u6743\u9650\u7684\u8FD0\u8425\u4EBA\u5458\u5904\u7406\u3002");
  const editable = (letter) => {
    const pair = state.pairs.find((p) => p.id === letter.pairId);
    ensure(actor.id === letter.authorId || actor.role === "teacher" && pair?.teacherId === actor.id && letter.createdBy === actor.id, "\u4F60\u53EA\u80FD\u4FEE\u6539\u81EA\u5DF1\u5199\u7684\u4FE1\u6216\u81EA\u5DF1\u4EE3\u5F55\u7684\u56DE\u4FE1\u3002");
    ensure(!pair || pair.status !== "ended", "\u8FD9\u7EC4\u966A\u4F34\u5DF2\u7ECF\u7ED3\u675F\u3002");
    ensure(letter.moderation === "draft" || letter.moderation === "returned", "\u8FD9\u5C01\u4FE1\u5DF2\u63D0\u4EA4\uFF0C\u8BF7\u7B49\u5F85\u5BA1\u6838\u7ED3\u679C\u3002");
  };
  switch (command.type) {
    case "match": {
      operator2();
      const existing = state.pairs.find((p) => p.status !== "ended" && p.childId === command.childId && p.volunteerId === command.volunteerId);
      if (existing) break;
      const child = state.people.find((p) => p.id === command.childId && p.role === "child");
      const volunteer = state.people.find((p) => p.id === command.volunteerId && p.role === "volunteer");
      ensure(child && volunteer && state.people.some((p) => p.id === command.teacherId && p.role === "teacher"), "\u8BF7\u9009\u62E9\u6709\u6548\u7684\u5C0F\u670B\u53CB\u3001\u5FD7\u613F\u8005\u548C\u8001\u5E08\u3002");
      if (options.formal) {
        ensure(child.guardianConsent && child.accountStatus === "active", "\u8BF7\u5148\u5B8C\u6210\u6709\u6548\u7684\u76D1\u62A4\u6388\u6743\u3002");
        ensure(volunteer.volunteerApproved && volunteer.accountStatus === "active", "\u5FD7\u613F\u8005\u5C1A\u672A\u901A\u8FC7\u5BA1\u6838\u3002");
        ensure(child.teacherId === command.teacherId, "\u53EA\u80FD\u9009\u62E9\u8D1F\u8D23\u8FD9\u4F4D\u5C0F\u670B\u53CB\u7684\u8001\u5E08\u3002");
      }
      ensure(!state.pairs.some((p) => p.status !== "ended" && (p.childId === child.id || p.volunteerId === volunteer.id)), "\u8FD9\u4F4D\u4F19\u4F34\u5DF2\u6709\u7ED3\u5BF9\uFF0C\u8BF7\u9009\u62E9\u5C1A\u672A\u7ED3\u5BF9\u7684\u4F19\u4F34\u3002");
      const id = uid("pair"), dueAt = addDays(state.clock, 7);
      state.pairs.push({ id, childId: child.id, volunteerId: volunteer.id, teacherId: command.teacherId, channel: command.channel, status: "active", startedAt: state.clock, pauseHistory: [] });
      state.tasks.push({ id: `first-${id}`, pairId: id, letterId: "", recipientId: volunteer.id, dueAt, baseDueAt: dueAt, createdAt: state.clock, status: "awaiting", kind: "first-letter", exclusions: [] });
      break;
    }
    case "save-letter": {
      const pair = command.pairId ? pairById(command.pairId) : void 0;
      ensure(!pair || pair.status !== "ended", "\u8FD9\u7EC4\u966A\u4F34\u5DF2\u7ECF\u7ED3\u675F\u3002");
      ensure(command.title.trim().length <= 60, "\u6807\u9898\u8BF7\u63A7\u5236\u5728 60 \u5B57\u4EE5\u5185\u3002");
      ensure(command.id === void 0 || command.id.trim().length > 0 && command.id.length <= 120, "\u8FD9\u5C01\u4FE1\u7684\u6807\u8BC6\u65E0\u6548\u3002");
      ensure(command.body.length <= 6e3, "\u4FE1\u4EF6\u6B63\u6587\u8BF7\u63A7\u5236\u5728 6000 \u5B57\u4EE5\u5185\u3002");
      ensure(!command.riddleId || riddles.some((r) => r.id === command.riddleId), "\u8FD9\u9053\u8C1C\u8BED\u4E0D\u5B58\u5728\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u3002");
      ensure(actor.role === "child" || actor.role === "volunteer" || actor.role === "teacher" && pair?.teacherId === actor.id, "\u4F60\u6CA1\u6709\u5199\u8FD9\u5C01\u4FE1\u7684\u6743\u9650\u3002");
      const authorId = actor.role === "teacher" ? pair.childId : actor.id;
      ensure(!command.authorId || command.authorId === authorId, "\u4E0D\u80FD\u66FF\u6362\u5199\u4FE1\u4EBA\u3002");
      ensure(!pair || authorId === pair.childId || authorId === pair.volunteerId, "\u8BF7\u9009\u62E9\u81EA\u5DF1\u7684\u4E66\u4FE1\u4F19\u4F34\u3002");
      ensure(pair || !state.pairs.some((p) => p.status !== "ended" && (p.childId === actor.id || p.volunteerId === actor.id)), "\u8BF7\u5C06\u8349\u7A3F\u5199\u7ED9\u5F53\u524D\u7684\u4E66\u4FE1\u4F19\u4F34\u3002");
      const recipientId = pair ? authorId === pair.childId ? pair.volunteerId : pair.childId : void 0;
      ensure(!command.recipientId || command.recipientId === recipientId, "\u4E0D\u80FD\u5411\u672A\u7ED3\u5BF9\u7684\u4EBA\u5BC4\u4FE1\u3002");
      if (command.replyTo) {
        const original = letterById(command.replyTo);
        ensure(original.pairId === pair?.id && recipientForLetter(state, original) === authorId && original.moderation === "approved" && state.deliveries.some((d) => d.letterId === original.id && d.deliveredAt), "\u539F\u4FE1\u786E\u8BA4\u9001\u8FBE\u540E\uFF0C\u624D\u53EF\u4EE5\u5199\u56DE\u4FE1\u3002");
      }
      let letter = command.id ? state.letters.find((l) => l.id === command.id) : state.letters.find((l) => l.pairId === command.pairId && l.authorId === authorId && l.createdBy === actor.id && l.replyTo === command.replyTo && (l.moderation === "draft" || l.moderation === "returned") && l.title === command.title.trim() && l.body === command.body && l.riddleId === command.riddleId);
      if (letter) {
        editable(letter);
        const introductionBinding = !letter.pairId && !!pair && !letter.replyTo && letter.authorId === actor.id;
        ensure((letter.pairId === command.pairId || introductionBinding) && letter.authorId === authorId && letter.replyTo === command.replyTo, "\u4FEE\u6539\u65F6\u4E0D\u80FD\u66F4\u6362\u4FE1\u4EF6\u7684\u4F19\u4F34\u6216\u539F\u4FE1\u3002");
        const unchanged = !command.file && !command.removeAttachment && (!command.attachmentId || command.attachmentId === letter.attachmentId) && letter.pairId === command.pairId && letter.title === command.title.trim() && letter.body === command.body && letter.riddleId === command.riddleId;
        if (unchanged) break;
        ensure(command.expectedRevision === void 0 || command.expectedRevision === letter.revision, "\u8FD9\u5C01\u8349\u7A3F\u5DF2\u5728\u53E6\u4E00\u53F0\u8BBE\u5907\u66F4\u65B0\u3002\u8BF7\u4FDD\u7559\u5F53\u524D\u6587\u5B57\uFF0C\u91CD\u65B0\u8F7D\u5165\u540E\u5408\u5E76\u3002");
        if (introductionBinding) {
          letter.pairId = pair.id;
          letter.recipientId = recipientId;
        }
      } else {
        ensure(command.expectedRevision === void 0 || command.expectedRevision === 0, "\u8FD9\u5C01\u8349\u7A3F\u7684\u7248\u672C\u5DF2\u53D8\u5316\uFF0C\u8BF7\u91CD\u65B0\u8F7D\u5165\u3002");
        letter = { id: command.id ?? uid("letter"), pairId: command.pairId, authorId, recipientId, createdBy: actor.id, title: "", body: "", replyTo: command.replyTo, moderation: "draft", createdAt: state.clock, updatedAt: state.clock, revision: 0, coveredLetterIds: [], submissionVersions: [] };
        state.letters.push(letter);
      }
      letter.title = command.title.trim();
      letter.body = command.body;
      letter.riddleId = command.riddleId;
      letter.updatedAt = state.clock;
      letter.revision = (letter.revision ?? 0) + 1;
      if (command.removeAttachment) letter.attachmentId = void 0;
      if (command.attachmentId) {
        const attachment = state.attachments.find((a) => a.id === command.attachmentId);
        ensure(attachment && attachment.ownerId === actor.id && (!attachment.pairId || attachment.pairId === command.pairId), "\u9644\u4EF6\u4E0D\u5C5E\u4E8E\u5F53\u524D\u8D26\u53F7\u6216\u4E66\u4FE1\u4F19\u4F34\u3002");
        letter.attachmentId = attachment.id;
        attachment.pairId = command.pairId;
      }
      if (command.file) {
        ensure(!options.formal, "\u8BF7\u5148\u901A\u8FC7\u53D7\u4FDD\u62A4\u7684\u9644\u4EF6\u63A5\u53E3\u4E0A\u4F20\u56FE\u7247\u3002");
        const attachment = { id: uid("attachment"), pairId: command.pairId, name: command.file.name, type: command.file.type, blob: command.file, ownerId: actor.id };
        state.attachments.push(attachment);
        letter.attachmentId = attachment.id;
      }
      const referenced = new Set(state.letters.flatMap((l) => [l.attachmentId, ...(l.submissionVersions ?? []).map((v) => v.attachmentId)]));
      if (!options.formal) state.attachments = state.attachments.filter((a) => referenced.has(a.id));
      break;
    }
    case "submit-letter": {
      const letter = letterById(command.id);
      ensure(actor.id === letter.authorId || actor.id === letter.createdBy, "\u4F60\u4E0D\u80FD\u63D0\u4EA4\u8FD9\u5C01\u4FE1\u3002");
      active(letter.pairId);
      if (letter.moderation === "pending" || letter.moderation === "approved") break;
      editable(letter);
      ensure(letter.body.trim().length > 0 || letter.attachmentId, "\u5199\u4E0B\u4E00\u70B9\u60F3\u5206\u4EAB\u7684\u4E8B\uFF0C\u6216\u9644\u4E0A\u624B\u5199\u4FE1\u56FE\u7247\u540E\u518D\u5BC4\u51FA\u3002");
      if (options.formal && actor.role === "teacher") ensure(command.confirmedByChild, "\u8BF7\u5148\u8BA9\u5C0F\u670B\u53CB\u6838\u5BF9\u4EE3\u5F55\u5185\u5BB9\uFF0C\u518D\u786E\u8BA4\u63D0\u4EA4\u3002");
      if (actor.role === "teacher" && command.confirmedByChild) letter.childConfirmedAt = state.clock;
      letter.title ||= letter.body.trim().split(/\r?\n/)[0].slice(0, 24) || "\u7ED9\u4F19\u4F34\u7684\u4E00\u5C01\u4FE1";
      const coverage = [...new Set(command.coveredLetterIds ?? (letter.replyTo ? [letter.replyTo] : []))];
      for (const id of coverage) ensure(state.tasks.some((t) => t.letterId === id && t.pairId === letter.pairId && t.recipientId === letter.authorId && t.status === "awaiting"), "\u6240\u9009\u6765\u4FE1\u5DF2\u88AB\u56DE\u5E94\u6216\u6B63\u5728\u5BA1\u6838\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u3002");
      letter.coveredLetterIds = coverage;
      letter.submissionVersions.push({ revision: letter.revision, title: letter.title, body: letter.body, riddleId: letter.riddleId, attachmentId: letter.attachmentId, coveredLetterIds: [...coverage], submittedAt: state.clock, submittedBy: actor.id });
      letter.moderation = "pending";
      letter.updatedAt = state.clock;
      for (const task of state.tasks.filter((t) => t.pairId === letter.pairId && t.recipientId === letter.authorId && (coverage.includes(t.letterId) || t.kind === "first-letter") && t.status === "awaiting")) {
        task.status = "review";
        task.reviewLetterId = letter.id;
        task.exclusions.push({ start: state.clock, kind: "review", sourceId: letter.id });
      }
      break;
    }
    case "review-letter": {
      operator2("review");
      const letter = letterById(command.id);
      if (letter.moderation === command.decision) break;
      ensure(letter.moderation === "pending", "\u53EA\u6709\u5F85\u5BA1\u6838\u7684\u4FE1\u4EF6\u53EF\u4EE5\u5BA1\u6838\u3002");
      const pair = pairById(letter.pairId);
      ensure(pair.status !== "ended" || command.decision === "returned", "\u966A\u4F34\u5DF2\u7ED3\u675F\uFF0C\u4E0D\u80FD\u7EE7\u7EED\u9001\u51FA\u4FE1\u4EF6\u3002");
      ensure(command.decision === "approved" || command.note.trim().length >= 3, "\u8BF7\u5199\u4E0B\u5177\u4F53\u7684\u4FEE\u6539\u5EFA\u8BAE\u3002");
      letter.moderation = command.decision;
      letter.moderationNote = command.note.trim();
      letter.updatedAt = state.clock;
      state.reviews.push({ id: uid("review"), letterId: letter.id, operatorId: actor.id, decision: command.decision, note: command.note.trim(), createdAt: state.clock, revision: letter.revision });
      for (const task of state.tasks.filter((t) => t.reviewLetterId === letter.id && t.status === "review")) {
        for (const interval of task.exclusions ?? []) if (interval.kind === "review" && interval.sourceId === letter.id && !interval.end) interval.end = state.clock;
        task.status = command.decision === "approved" ? "completed" : "awaiting";
        task.reviewLetterId = void 0;
        if (task.status === "completed") task.completedAt = state.clock;
      }
      if (command.decision === "approved") {
        if (!state.deliveries.some((d) => d.letterId === letter.id)) state.deliveries.push({ letterId: letter.id });
        if (pair.channel === "online") deliver(state, letter);
      }
      break;
    }
    case "print":
    case "deliver": {
      ensure(actor.role === "teacher", "\u8BF7\u4F7F\u7528\u8D1F\u8D23\u6536\u53D1\u7684\u8001\u5E08\u8D26\u53F7\u3002");
      for (const id of new Set(command.ids)) {
        const letter = letterById(id), pair = active(letter.pairId);
        ensure(pair.teacherId === actor.id && pair.channel === "paper" && letter.moderation === "approved", "\u53EA\u80FD\u5904\u7406\u81EA\u5DF1\u8D1F\u8D23\u7684\u3001\u5DF2\u5BA1\u6838\u901A\u8FC7\u7684\u7EB8\u8D28\u4FE1\u4EF6\u3002");
        let delivery = state.deliveries.find((d) => d.letterId === id);
        if (!delivery) {
          delivery = { letterId: id };
          state.deliveries.push(delivery);
        }
        if (command.type === "print") delivery.printedAt ??= state.clock;
        else {
          ensure(delivery.printedAt, "\u8BF7\u5148\u6253\u5370\u8FD9\u5C01\u4FE1\uFF0C\u518D\u786E\u8BA4\u5B9E\u9645\u4EA4\u4ED8\u3002");
          deliver(state, letter);
        }
      }
      break;
    }
    case "read": {
      const letter = letterById(command.id);
      ensure(canReadLetter(state, actor, letter), "\u8FD9\u5C01\u4FE1\u6682\u65F6\u4E0D\u5728\u4F60\u7684\u53EF\u8BFB\u8303\u56F4\u5185\u3002");
      if (recipientForLetter(state, letter) === actor.id) {
        const delivery = state.deliveries.find((d) => d.letterId === letter.id);
        ensure(letter.moderation === "approved" && delivery?.deliveredAt, "\u4FE1\u4EF6\u5C1A\u672A\u9001\u8FBE\u3002");
        delivery.readAt ??= state.clock;
      }
      break;
    }
    case "pause-pair": {
      operator2();
      const pair = pairById(command.id);
      if (pair.status === "paused") break;
      ensure(pair.status !== "ended", "\u966A\u4F34\u5DF2\u7ED3\u675F\u3002");
      ensure(command.reason.trim().length >= 2, "\u8BF7\u8BB0\u5F55\u6682\u505C\u539F\u56E0\u3002");
      pair.status = "paused";
      pair.pausedAt = state.clock;
      pair.pauseReason = command.reason.trim();
      pair.pauseHistory.push({ start: state.clock, kind: "pause", sourceId: pair.id });
      break;
    }
    case "resume-pair": {
      operator2();
      const pair = pairById(command.id);
      if (pair.status === "active") break;
      ensure(pair.status !== "ended", "\u966A\u4F34\u5DF2\u7ED3\u675F\uFF0C\u8BF7\u91CD\u65B0\u5EFA\u7ACB\u7ED3\u5BF9\u3002");
      for (const interval of pair.pauseHistory ?? []) if (!interval.end) interval.end = state.clock;
      pair.status = "active";
      pair.pausedAt = void 0;
      pair.pauseReason = void 0;
      for (const letter of state.letters.filter((l) => l.pairId === pair.id && l.moderation === "approved" && !state.deliveries.some((d) => d.letterId === l.id && d.deliveredAt))) if (pair.channel === "online") deliver(state, letter);
      break;
    }
    case "end-pair": {
      operator2();
      const pair = pairById(command.id);
      if (pair.status === "ended") break;
      ensure(command.reason.trim().length >= 2, "\u8BF7\u8BB0\u5F55\u7ED3\u675F\u539F\u56E0\u3002");
      pair.status = "ended";
      pair.endedAt = state.clock;
      pair.endReason = command.reason.trim();
      for (const interval of pair.pauseHistory ?? []) if (!interval.end) interval.end = state.clock;
      for (const task of state.tasks.filter((t) => t.pairId === pair.id && t.status !== "completed")) {
        task.status = "completed";
        task.completedAt = state.clock;
      }
      break;
    }
    case "extend-task": {
      operator2();
      const task = state.tasks.find((t) => t.id === command.id);
      ensure(task && task.status !== "completed", "\u8FD9\u6761\u56DE\u5E94\u4EFB\u52A1\u5DF2\u7ED3\u675F\u6216\u4E0D\u5B58\u5728\u3002");
      refreshDeadlines(state);
      ensure(Number.isFinite(Date.parse(command.dueAt)) && Date.parse(command.dueAt) > Date.parse(task.dueAt), "\u65B0\u7684\u671F\u9650\u5E94\u665A\u4E8E\u5F53\u524D\u671F\u9650\u3002");
      ensure(command.reason.trim().length >= 2, "\u8BF7\u8BB0\u5F55\u5EF6\u671F\u539F\u56E0\u3002");
      task.baseDueAt = new Date(Date.parse(task.baseDueAt) + Date.parse(command.dueAt) - Date.parse(task.dueAt)).toISOString();
      task.extensionReason = command.reason.trim();
      break;
    }
    case "help": {
      ensure(actor.role !== "operator", "\u8FD0\u8425\u4EBA\u5458\u8BF7\u5728\u8DDF\u8FDB\u4E8B\u9879\u4E2D\u8BB0\u5F55\u5904\u7406\u60C5\u51B5\u3002");
      ensure(command.body.trim().length >= 2 && command.body.length <= 2e3, "\u8BF7\u5199\u4E0B 2\u20142000 \u5B57\u7684\u60F3\u6CD5\u3002");
      const pair = command.pairId ? pairById(command.pairId) : state.pairs.find((p) => p.status !== "ended" && (p.childId === actor.id || p.volunteerId === actor.id));
      ensure(!pair || [pair.childId, pair.volunteerId, pair.teacherId].includes(actor.id), "\u8BF7\u9009\u62E9\u81EA\u5DF1\u7684\u4E66\u4FE1\u4F19\u4F34\u3002");
      state.followups.push({ id: uid("help"), pairId: pair?.id, requesterId: actor.id, ownerId: state.people.find((p) => hasPermission(p, "safeguarding"))?.id, kind: "help", status: "open", note: `${actor.nickname}\uFF1A${command.body.trim()}`, createdAt: state.clock, updatedAt: state.clock, history: [] });
      break;
    }
    case "resolve-followup":
    case "assign-followup":
    case "reopen-followup": {
      const followup = state.followups.find((f) => f.id === command.id);
      ensure(followup, "\u8FD9\u6761\u8DDF\u8FDB\u4E8B\u9879\u4E0D\u5B58\u5728\u3002");
      operator2(followup.kind === "help" ? "safeguarding" : "administration");
      if (command.nextFollowupAt) ensure(Number.isFinite(Date.parse(command.nextFollowupAt)) && Date.parse(command.nextFollowupAt) > Date.parse(state.clock), "\u4E0B\u6B21\u8DDF\u8FDB\u65F6\u95F4\u5E94\u665A\u4E8E\u73B0\u5728\u3002");
      if (command.type === "assign-followup") {
        ensure(state.people.some((p) => p.id === command.ownerId && hasPermission(p, followup.kind === "help" ? "safeguarding" : "administration")), "\u8BF7\u9009\u62E9\u6709\u5904\u7406\u6743\u9650\u7684\u8FD0\u8425\u4EBA\u5458\u3002");
        followup.ownerId = command.ownerId;
      } else {
        ensure(command.note.trim().length >= 3 && command.note.length <= 2e3, "\u8BF7\u8BB0\u5F55\u81F3\u5C11 3 \u5B57\u7684\u5904\u7406\u60C5\u51B5\u3002");
        followup.status = command.type === "resolve-followup" ? "resolved" : "open";
        followup.resolution = command.type === "resolve-followup" ? command.note.trim() : void 0;
        (followup.history ??= []).push({ at: state.clock, actorId: actor.id, note: command.note.trim() });
      }
      followup.nextFollowupAt = command.nextFollowupAt ?? (followup.kind === "overdue" && command.type === "resolve-followup" ? addDays(state.clock, 3) : followup.nextFollowupAt);
      followup.updatedAt = state.clock;
      break;
    }
    case "set-clock": {
      operator2();
      ensure(!options.formal, "\u771F\u5B9E\u8BD5\u7528\u4F7F\u7528\u670D\u52A1\u7AEF\u65F6\u95F4\uFF0C\u4E0D\u652F\u6301\u8C03\u6574\u6F14\u793A\u65E5\u671F\u3002");
      const value = Date.parse(command.value);
      ensure(Number.isFinite(value) && value >= Date.parse(state.clock), "\u6F14\u793A\u65F6\u95F4\u53EA\u80FD\u5411\u524D\u8C03\u6574\u3002\u9700\u8981\u91CD\u65B0\u5F00\u59CB\u65F6\uFF0C\u8BF7\u91CD\u7F6E\u6F14\u793A\u3002");
      state.clock = new Date(value).toISOString();
      break;
    }
    default:
      fail("\u4E0D\u652F\u6301\u7684\u4E1A\u52A1\u64CD\u4F5C\u3002");
  }
  reconcileFollowups(state);
  return state;
}

// core.ts
var ServiceError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
  code;
};
function requireValue(value, message, code = "INVALID_INPUT") {
  if (!value) throw new ServiceError(code, message);
}
function text(value, label, max = 200, optional = false) {
  requireValue(typeof value === "string", `${label}\u683C\u5F0F\u4E0D\u6B63\u786E`);
  const result = value.trim();
  requireValue((optional || result.length > 0) && result.length <= max, `${label}\u8BF7\u586B\u5199${max}\u5B57\u4EE5\u5185\u7684\u5185\u5BB9`);
  return result;
}
var digest = (value) => (0, import_node_crypto.createHash)("sha256").update(value).digest("hex");
function emptyStore(now = (/* @__PURE__ */ new Date()).toISOString()) {
  return { revision: 0, state: { id: "main", version: 1, clock: now, people: [], pairs: [], letters: [], deliveries: [], tasks: [], reviews: [], followups: [], attachments: [] }, accounts: {}, applications: [], invites: [], consents: [], privacyRequests: [], receipts: {}, audit: [], rates: {} };
}
function getAccount(store, identity, active = false) {
  requireValue(identity.uid && !identity.anonymous, "\u8BF7\u5148\u767B\u5F55", "UNAUTHENTICATED");
  const account = store.accounts[identity.uid];
  requireValue(account, "\u8BF7\u5148\u5B8C\u6210\u52A0\u5165\u7533\u8BF7\u6216\u9080\u8BF7\u6FC0\u6D3B", "ACCOUNT_REQUIRED");
  requireValue(account.status !== "disabled", "\u8D26\u53F7\u5DF2\u505C\u7528\uFF0C\u8BF7\u8054\u7CFB\u8D1F\u8D23\u8001\u5E08\u6216\u8FD0\u8425", "ACCOUNT_DISABLED");
  if (active) requireValue(account.status === "active", "\u52A0\u5165\u7533\u8BF7\u4ECD\u5728\u5BA1\u6838\u4E2D", "ACCOUNT_PENDING");
  return account;
}
function operator(account, permission) {
  requireValue(account.role === "operator" && (!permission || account.permissions.includes(permission)), "\u6CA1\u6709\u6B64\u9879\u64CD\u4F5C\u6743\u9650", "FORBIDDEN");
}
function syncPermissions(store) {
  for (const person of store.state.people) {
    const account = store.accounts[person.id];
    person.accountStatus = account?.status ?? "disabled";
    if (person.role === "operator") person.permissions = account?.status === "active" ? [
      ...account.permissions.includes("moderate") ? ["review"] : [],
      ...account.permissions.includes("help") ? ["safeguarding"] : [],
      ...account.permissions.includes("followup") ? ["administration"] : []
    ] : [];
  }
}
function snapshot(store, identity) {
  const account = getAccount(store, identity);
  syncPermissions(store);
  if (account.status !== "active") {
    const profile2 = store.state.people.find((person) => person.id === identity.uid);
    requireValue(profile2, "\u8D26\u53F7\u8D44\u6599\u5C1A\u672A\u5B8C\u6210\uFF0C\u8BF7\u8054\u7CFB\u8FD0\u8425", "PROFILE_MISSING");
    return { state: { ...emptyStore(store.state.clock).state, people: [profile2] }, profile: profile2, revision: store.revision, account: { ...account, application: store.applications.find((item) => item.userId === identity.uid) } };
  }
  const state = scopeState(normalizeState(store.state), identity.uid);
  state.attachments = state.attachments.map(({ blob: _blob, storagePath: _storagePath, ...safe }) => safe);
  state.people = state.people.map((person) => {
    const { guardianName: _name, ...safe } = person;
    return safe;
  });
  if (account.role === "operator" && !account.permissions.includes("help")) state.followups = state.followups.filter((item) => item.kind !== "help");
  const profile = state.people.find((person) => person.id === identity.uid);
  requireValue(profile, "\u8D26\u53F7\u8D44\u6599\u5C1A\u672A\u5B8C\u6210\uFF0C\u8BF7\u8054\u7CFB\u8FD0\u8425", "PROFILE_MISSING");
  return { state, profile, revision: store.revision, account: { ...account, application: store.applications.find((item) => item.userId === identity.uid) } };
}
async function executeSnapshot(repository, identity, now = (/* @__PURE__ */ new Date()).toISOString()) {
  const viewed = await repository.read((store) => {
    getAccount(store, identity);
    syncPermissions(store);
    const original = store.state.followups;
    store.state = refreshState(store.state, now);
    return { result: snapshot(store, identity), changed: JSON.stringify(original) !== JSON.stringify(store.state.followups) };
  });
  if (!viewed.changed) return viewed.result;
  return repository.transact((store) => {
    getAccount(store, identity);
    syncPermissions(store);
    store.state = refreshState(store.state, now);
    return snapshot(store, identity);
  });
}
function audit(store, actorId, action, targetId) {
  store.audit.push({ id: (0, import_node_crypto.randomUUID)(), actorId, action, targetId, at: store.state.clock });
  if (store.audit.length > 2e3) store.audit.splice(0, store.audit.length - 2e3);
}
function throttle(store, key, now, limit = 60) {
  const minute = Math.floor(Date.parse(now) / 6e4);
  const old = store.rates[key];
  const next = old?.minute === minute ? { minute, count: old.count + 1 } : { minute, count: 1 };
  requireValue(next.count <= limit, "\u64CD\u4F5C\u6709\u4E9B\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5", "RATE_LIMITED");
  store.rates[key] = next;
  for (const [id, value] of Object.entries(store.rates)) if (value.minute < minute - 2) delete store.rates[id];
}
var commandTypes = /* @__PURE__ */ new Set(["match", "save-letter", "submit-letter", "review-letter", "print", "deliver", "read", "pause-pair", "resume-pair", "end-pair", "extend-task", "help", "resolve-followup", "assign-followup", "reopen-followup"]);
function resultId(command, previous, next) {
  if (command.type === "match") return next.pairs.find((item) => !previous.pairs.some((old) => old.id === item.id))?.id ?? next.pairs.find((item) => item.status !== "ended" && item.childId === command.childId && item.volunteerId === command.volunteerId)?.id ?? "";
  if (command.type === "save-letter") return command.id ?? next.letters.find((item) => !previous.letters.some((old) => old.id === item.id))?.id ?? "";
  if (command.type === "help") return next.followups.find((item) => !previous.followups.some((old) => old.id === item.id))?.id ?? "";
  return "id" in command && typeof command.id === "string" ? command.id : "";
}
async function executeCommand(repository, identity, input, now = (/* @__PURE__ */ new Date()).toISOString()) {
  return repository.transact((store) => {
    const account = getAccount(store, identity, true);
    store.state.clock = now;
    syncPermissions(store);
    requireValue(typeof input.requestId === "string" && /^[a-zA-Z0-9_-]{12,100}$/.test(input.requestId), "\u7F3A\u5C11\u6709\u6548\u7684\u64CD\u4F5C\u7F16\u53F7");
    requireValue(input.command && commandTypes.has(input.command.type), "\u4E0D\u652F\u6301\u6B64\u9879\u64CD\u4F5C");
    requireValue(!("file" in input.command) && !("actorId" in input.command), "\u8BF7\u901A\u8FC7\u5B89\u5168\u9644\u4EF6\u63A5\u53E3\u4E0A\u4F20\u56FE\u7247");
    requireValue(JSON.stringify(input.command).length < 3e4, "\u5185\u5BB9\u8FC7\u957F\uFF0C\u8BF7\u7F29\u77ED\u540E\u518D\u8BD5");
    if (input.command.type === "save-letter") {
      text(input.command.body, "\u6B63\u6587", 12e3, true);
      text(input.command.title ?? "", "\u6807\u9898", 120, true);
    }
    if (input.command.type === "review-letter") operator(account, "moderate");
    if (["resolve-followup", "assign-followup", "reopen-followup"].includes(input.command.type)) {
      const item = store.state.followups.find((item2) => item2.id === input.command.id);
      operator(account, item?.kind === "help" ? "help" : "followup");
    }
    const key = `${identity.uid}:${input.requestId}`;
    const hash = digest(JSON.stringify(input.command));
    const previous = store.receipts[key];
    if (previous) {
      requireValue(previous.hash === hash, "\u64CD\u4F5C\u7F16\u53F7\u5DF2\u7528\u4E8E\u5176\u4ED6\u5185\u5BB9", "CONFLICT");
      return { ...snapshot(store, identity), resultId: previous.resultId };
    }
    if (input.expectedRevision !== void 0) requireValue(input.expectedRevision === store.revision, "\u5185\u5BB9\u5DF2\u5728\u53E6\u4E00\u53F0\u8BBE\u5907\u66F4\u65B0\uFF0C\u8BF7\u5237\u65B0\u540E\u6838\u5BF9\uFF1B\u4F60\u7684\u8F93\u5165\u4ECD\u7136\u4FDD\u7559", "CONFLICT");
    throttle(store, identity.uid, now);
    const previousState = store.state;
    const nextState = reduceCommand(previousState, identity.uid, input.command, { formal: true });
    const id = resultId(input.command, previousState, nextState);
    store.state = nextState;
    store.state.clock = now;
    store.revision++;
    store.receipts[key] = { hash, resultId: id, at: now };
    for (const [id2, receipt] of Object.entries(store.receipts)) if (Date.parse(receipt.at) < Date.parse(now) - 7 * 864e5) delete store.receipts[id2];
    audit(store, identity.uid, input.command.type, id);
    return { ...snapshot(store, identity), resultId: id };
  });
}
function accountStatus(store, identity) {
  const account = getAccount(store, identity);
  const accountManager = account.role === "operator" && account.permissions.includes("accounts");
  const privacyManager = account.role === "operator" && account.permissions.includes("privacy");
  return {
    account,
    profile: store.state.people.find((person) => person.id === identity.uid),
    applications: store.applications.filter((item) => accountManager || item.userId === identity.uid).map(({ note, ...item }) => ({ ...item, decisionNote: note })),
    invites: store.invites.filter((item) => accountManager || item.createdBy === identity.uid).map(({ tokenHash: _token, activationId: _activation, ...safe }) => safe),
    consents: store.consents.filter((item) => privacyManager || item.teacherId === identity.uid).map((item) => ({ ...item, childId: item.childId ?? "", status: item.withdrawnAt ? "withdrawn" : "recorded" })),
    privacyRequests: store.privacyRequests.filter((item) => privacyManager || item.userId === identity.uid).map((item) => ({ ...item, requesterId: item.userId, resolution: item.note })),
    accounts: (accountManager ? Object.values(store.accounts) : account.role === "teacher" ? Object.values(store.accounts).filter((item) => item.role === "child" && store.state.people.some((person) => person.id === item.uid && person.teacherId === identity.uid)) : []).map((item) => ({ id: item.uid, uid: item.uid, role: item.role, status: item.status, nickname: store.state.people.find((person) => person.id === item.uid)?.nickname ?? "\u53C2\u4E0E\u8005" }))
  };
}
async function executeAccountAction(repository, identity, action, payload, now = (/* @__PURE__ */ new Date()).toISOString()) {
  return repository.transact((store) => {
    store.state.clock = now;
    if (action === "apply-volunteer") {
      requireValue(identity.uid && !identity.anonymous && identity.email, "\u8BF7\u5148\u5B8C\u6210\u90AE\u7BB1\u9A8C\u8BC1\u7801\u9A8C\u8BC1", "UNAUTHENTICATED");
      const prior = store.accounts[identity.uid];
      requireValue(!prior || prior.role === "volunteer" && prior.status !== "disabled", "\u5F53\u524D\u8D26\u53F7\u4E0D\u80FD\u7533\u8BF7\u5FD7\u613F\u8005");
      const existing = store.applications.find((item) => item.userId === identity.uid);
      requireValue(!existing || existing.status !== "approved", "\u7533\u8BF7\u5DF2\u7ECF\u901A\u8FC7\uFF0C\u65E0\u9700\u91CD\u590D\u63D0\u4EA4");
      requireValue(payload.agreementAccepted === true, "\u8BF7\u9605\u8BFB\u5E76\u786E\u8BA4\u966A\u4F34\u7EA6\u5B9A");
      const nickname = text(payload.nickname, "\u6635\u79F0", 30);
      const application = { id: existing?.id ?? (0, import_node_crypto.randomUUID)(), userId: identity.uid, nickname, email: identity.email, institution: text(payload.institution, "\u5B66\u6821\u6216\u673A\u6784", 100), availability: text(payload.availability, "\u53EF\u53C2\u4E0E\u65F6\u95F4", 300), agreementAcceptedAt: now, status: "pending", updatedAt: now };
      store.applications = [...store.applications.filter((item) => item.userId !== identity.uid), application];
      store.accounts[identity.uid] = { uid: identity.uid, role: "volunteer", status: "pending", permissions: [], createdAt: prior?.createdAt ?? now };
      const profile = { id: identity.uid, role: "volunteer", nickname, subtitle: "\u966A\u4F34\u7533\u8BF7\u5BA1\u6838\u4E2D", avatar: "\u{1F343}", interests: [], accountStatus: "pending", volunteerApproved: false };
      store.state.people = [...store.state.people.filter((person) => person.id !== identity.uid), profile];
      store.revision++;
      audit(store, identity.uid, action, application.id);
      return snapshot(store, identity);
    }
    const account = getAccount(store, identity);
    if (action === "status") return accountStatus(store, identity);
    throttle(store, identity.uid, now, 30);
    if (action === "review-application") {
      operator(account, "accounts");
      const item = store.applications.find((item2) => item2.id === payload.id);
      requireValue(item, "\u627E\u4E0D\u5230\u7533\u8BF7");
      requireValue(["approved", "returned"].includes(String(payload.decision)), "\u8BF7\u9009\u62E9\u5BA1\u6838\u7ED3\u679C");
      item.status = payload.decision;
      item.note = text(payload.note ?? "", "\u5BA1\u6838\u8BF4\u660E", 1e3, item.status === "approved");
      item.reviewedBy = identity.uid;
      item.updatedAt = now;
      const target = store.accounts[item.userId];
      target.status = item.status === "approved" ? "active" : "pending";
      Object.assign(store.state.people.find((person) => person.id === item.userId), { accountStatus: target.status, volunteerApproved: item.status === "approved", subtitle: item.status === "approved" ? "\u5DF2\u901A\u8FC7\u966A\u4F34\u5BA1\u6838" : "\u8BF7\u67E5\u770B\u7533\u8BF7\u4FEE\u6539\u610F\u89C1" });
      if (item.status === "returned") for (const pair of store.state.pairs.filter((pair2) => pair2.volunteerId === item.userId && pair2.status === "active")) {
        pair.status = "paused";
        pair.pausedAt = now;
        pair.pauseReason = "\u5FD7\u613F\u8005\u8D44\u683C\u6B63\u5728\u590D\u6838";
        (pair.pauseHistory ??= []).push({ start: now, kind: "pause", sourceId: pair.id });
      }
    } else if (action === "create-invite") {
      requireValue(account.status === "active" && ["teacher", "operator"].includes(account.role), "\u53EA\u6709\u8D1F\u8D23\u8001\u5E08\u6216\u8FD0\u8425\u53EF\u4EE5\u9080\u8BF7", "FORBIDDEN");
      const role = payload.role;
      requireValue(["child", "teacher", "operator"].includes(String(role)), "\u9080\u8BF7\u8EAB\u4EFD\u4E0D\u6B63\u786E");
      if (role !== "child") operator(account, "accounts");
      const teacherId = account.role === "teacher" ? identity.uid : role === "child" ? text(payload.teacherId, "\u8D1F\u8D23\u8001\u5E08", 100) : void 0;
      if (teacherId) requireValue(store.accounts[teacherId]?.role === "teacher" && store.accounts[teacherId]?.status === "active", "\u8BF7\u9009\u62E9\u6709\u6548\u7684\u8D1F\u8D23\u8001\u5E08");
      let consentId;
      if (role === "child") {
        const consent = payload.guardianConsent;
        requireValue(consent && typeof consent === "object", "\u8BF7\u5148\u8BB0\u5F55\u76D1\u62A4\u4EBA\u6388\u6743");
        consentId = (0, import_node_crypto.randomUUID)();
        store.consents.push({ id: consentId, teacherId, guardianName: text(consent.guardianName, "\u76D1\u62A4\u4EBA\u59D3\u540D", 50), relationship: text(consent.relationship, "\u76D1\u62A4\u5173\u7CFB", 50), noticeVersion: text(consent.noticeVersion, "\u544A\u77E5\u4E66\u7248\u672C", 100), evidenceReference: text(consent.evidenceReference, "\u5DF2\u53D6\u5F97\u6388\u6743\u7684\u51ED\u8BC1\u7F16\u53F7", 200), recordedBy: identity.uid, recordedAt: now });
      }
      const email = role === "child" ? void 0 : text(payload.email, "\u88AB\u9080\u8BF7\u4EBA\u7684\u90AE\u7BB1", 200);
      requireValue(!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), "\u90AE\u7BB1\u683C\u5F0F\u4E0D\u6B63\u786E");
      const requestedPermissions = role === "operator" ? payload.permissions === void 0 ? ["moderate", "followup"] : payload.permissions : [];
      requireValue(Array.isArray(requestedPermissions) && requestedPermissions.every((permission) => typeof permission === "string" && ["accounts", "moderate", "followup", "help", "privacy"].includes(permission) && account.permissions.includes(permission)), "\u4E0D\u80FD\u6388\u4E88\u8D85\u51FA\u81EA\u8EAB\u8303\u56F4\u7684\u6743\u9650", "FORBIDDEN");
      const token = (0, import_node_crypto.randomBytes)(32).toString("base64url");
      const invite = { id: (0, import_node_crypto.randomUUID)(), tokenHash: digest(token), role, nickname: text(payload.nickname, "\u6635\u79F0", 30), email, permissions: [...requestedPermissions], teacherId, createdBy: identity.uid, createdAt: now, expiresAt: new Date(Date.parse(now) + 72 * 36e5).toISOString(), status: "open", consentId };
      store.invites.push(invite);
      store.revision++;
      audit(store, identity.uid, action, invite.id);
      return { token, expiresAt: invite.expiresAt, id: invite.id };
    } else if (action === "withdraw-consent") {
      const childId = text(payload.childId, "\u5B69\u5B50\u8D26\u53F7", 100);
      const child = store.state.people.find((person) => person.id === childId && person.role === "child");
      requireValue(child && (account.role === "teacher" && child.teacherId === identity.uid || account.role === "operator" && account.permissions.includes("privacy")), "\u6CA1\u6709\u6B64\u9879\u64CD\u4F5C\u6743\u9650", "FORBIDDEN");
      const reason = text(payload.reason, "\u64A4\u56DE\u8BF4\u660E", 1e3);
      for (const consent of store.consents.filter((item) => item.childId === childId && !item.withdrawnAt)) {
        consent.withdrawnAt = now;
        consent.reason = reason;
      }
      child.guardianConsent = false;
      child.accountStatus = "disabled";
      store.accounts[childId].status = "disabled";
      for (const pair of store.state.pairs.filter((item) => item.childId === childId && item.status === "active")) {
        pair.status = "paused";
        pair.pausedAt = now;
        pair.pauseReason = "\u76D1\u62A4\u6388\u6743\u5DF2\u64A4\u56DE";
        (pair.pauseHistory ??= []).push({ start: now, kind: "pause", sourceId: pair.id });
      }
    } else if (action === "privacy-request") {
      requireValue(["export", "delete", "withdraw"].includes(String(payload.kind)), "\u8BF7\u9009\u62E9\u7533\u8BF7\u7C7B\u578B");
      const prior = store.privacyRequests.find((item) => item.userId === identity.uid && item.kind === payload.kind && item.status === "open");
      if (!prior) store.privacyRequests.push({ id: (0, import_node_crypto.randomUUID)(), userId: identity.uid, kind: payload.kind, reason: text(payload.reason, "\u7533\u8BF7\u8BF4\u660E", 1e3), status: "open", createdAt: now });
    } else if (action === "resolve-privacy-request") {
      operator(account, "privacy");
      const item = store.privacyRequests.find((item2) => item2.id === payload.id);
      requireValue(item, "\u627E\u4E0D\u5230\u7533\u8BF7");
      requireValue(payload.completed === true, "\u5B8C\u6210\u8D44\u6599\u5904\u7406\u540E\u624D\u53EF\u6807\u8BB0\u5DF2\u5904\u7406\uFF1B\u8BF7\u5148\u6838\u5BF9\u7533\u8BF7\u4EBA\u53CA\u76D1\u62A4\u6388\u6743", "PROCESSING_REQUIRED");
      item.status = "resolved";
      item.note = text(payload.note, "\u5904\u7406\u51ED\u8BC1\u53CA\u7ED3\u679C", 1e3);
      item.resolvedBy = identity.uid;
    } else if (action === "set-account-status") {
      operator(account, "accounts");
      const target = store.accounts[text(payload.id, "\u8D26\u53F7", 100)];
      requireValue(target && target.uid !== identity.uid, "\u4E0D\u80FD\u901A\u8FC7\u8FD9\u91CC\u66F4\u6539\u81EA\u5DF1\u7684\u8D26\u53F7");
      requireValue(["active", "disabled"].includes(String(payload.status)), "\u72B6\u6001\u4E0D\u6B63\u786E");
      const person = store.state.people.find((item) => item.id === target.uid);
      if (payload.status === "active") requireValue((person.role !== "child" || person.guardianConsent) && (person.role !== "volunteer" || person.volunteerApproved), "\u8BF7\u5148\u5B8C\u6210\u76D1\u62A4\u6388\u6743\u6216\u5FD7\u613F\u8005\u5BA1\u6838");
      target.status = payload.status;
      target.disabledReason = text(payload.reason, "\u53D8\u66F4\u539F\u56E0", 1e3);
      person.accountStatus = target.status;
      if (target.status === "disabled") for (const pair of store.state.pairs.filter((item) => item.status === "active" && [item.childId, item.volunteerId].includes(target.uid))) {
        pair.status = "paused";
        pair.pausedAt = now;
        pair.pauseReason = "\u53C2\u4E0E\u8D26\u53F7\u5DF2\u505C\u7528";
        (pair.pauseHistory ??= []).push({ start: now, kind: "pause", sourceId: pair.id });
      }
    } else throw new ServiceError("INVALID_ACTION", "\u4E0D\u652F\u6301\u6B64\u9879\u8D26\u53F7\u64CD\u4F5C");
    store.revision++;
    audit(store, identity.uid, action, typeof payload.id === "string" ? payload.id : void 0);
    return accountStatus(store, identity);
  });
}
async function reserveInvite(repository, token, username, activationId, now = (/* @__PURE__ */ new Date()).toISOString()) {
  requireValue(typeof token === "string" && token.length >= 32 && token.length <= 128, "\u9080\u8BF7\u4FE1\u606F\u4E0D\u6B63\u786E", "INVITE_INVALID");
  requireValue(/^[A-Za-z0-9][A-Za-z0-9_.-]{4,23}$/.test(username), "\u8D26\u53F7\u9700\u4E3A5\u81F324\u4F4D\u5B57\u6BCD\u3001\u6570\u5B57\u6216 ._-");
  requireValue(/^[a-zA-Z0-9_-]{12,100}$/.test(activationId), "\u7F3A\u5C11\u6FC0\u6D3B\u7F16\u53F7");
  return repository.transact((store) => {
    const invite = store.invites.find((item) => item.tokenHash === digest(token));
    requireValue(invite && Date.parse(invite.expiresAt) > Date.parse(now), "\u9080\u8BF7\u5DF2\u5931\u6548\uFF0C\u8BF7\u5411\u8001\u5E08\u6216\u8FD0\u8425\u7533\u8BF7\u65B0\u9080\u8BF7", "INVITE_INVALID");
    requireValue(invite.status === "open" || ["activating", "used"].includes(invite.status) && invite.activationId === activationId && invite.username === username, "\u9080\u8BF7\u5DF2\u4F7F\u7528\uFF0C\u8BF7\u76F4\u63A5\u767B\u5F55\u6216\u8054\u7CFB\u9080\u8BF7\u4EBA", "INVITE_USED");
    invite.status = invite.status === "used" ? "used" : "activating";
    invite.activationId = activationId;
    invite.username = username;
    invite.userId ??= `inv_${digest(invite.id).slice(0, 28)}`;
    return { ...invite };
  });
}
async function finishInvite(repository, inviteId, activationId, authUid, now = (/* @__PURE__ */ new Date()).toISOString()) {
  return repository.transact((store) => {
    const invite = store.invites.find((item) => item.id === inviteId);
    requireValue(invite && invite.activationId === activationId && invite.userId === authUid && ["activating", "used"].includes(invite.status), "\u9080\u8BF7\u6FC0\u6D3B\u72B6\u6001\u5DF2\u53D8\u5316", "CONFLICT");
    if (invite.status === "used") return { username: invite.username };
    const permissions = invite.role === "operator" ? invite.permissions ?? [] : [];
    store.accounts[authUid] = { uid: authUid, role: invite.role, status: "active", permissions, createdAt: now };
    store.state.people.push({ id: authUid, role: invite.role, nickname: invite.nickname, subtitle: invite.role === "child" ? "\u671F\u5F85\u8BA4\u8BC6\u4E00\u4F4D\u4E66\u4FE1\u4F19\u4F34" : "\u966A\u4F34\u8BA1\u5212\u53C2\u4E0E\u8005", avatar: invite.role === "child" ? "\u{1F331}" : invite.role === "teacher" ? "\u{1F4DA}" : "\u2709\uFE0F", interests: [], accountStatus: "active", teacherId: invite.teacherId, guardianConsent: invite.role === "child" ? true : void 0, permissions });
    if (invite.consentId) store.consents.find((item) => item.id === invite.consentId).childId = authUid;
    invite.status = "used";
    store.state.clock = now;
    store.revision++;
    audit(store, authUid, "activate-invite", invite.id);
    return { username: invite.username };
  });
}
function authorizeAttachment(store, identity, id) {
  const account = getAccount(store, identity, true);
  const attachment = store.state.attachments.find((item) => item.id === id);
  syncPermissions(store);
  requireValue(attachment, "\u56FE\u7247\u4E0D\u5B58\u5728", "NOT_FOUND");
  const ownerId = attachment.ownerId;
  const person = store.state.people.find((item) => item.id === account.uid);
  const current = store.state.letters.find((item) => item.attachmentId === id);
  const historical = store.state.letters.find((item) => item.submissionVersions?.some((version) => version.attachmentId === id));
  const currentAccess = current && canReadLetter(store.state, person, current);
  const historyAccess = historical && (historical.authorId === identity.uid || historical.createdBy === identity.uid || account.role === "operator" && account.permissions.includes("moderate"));
  requireValue(ownerId === identity.uid || currentAccess || historyAccess, "\u65E0\u6743\u67E5\u770B\u8FD9\u5F20\u56FE\u7247", "FORBIDDEN");
  return attachment;
}

// repository.ts
var import_node_sdk = __toESM(require("@cloudbase/node-sdk"), 1);
var PARTS = ["accounts", "applications", "invites", "consents", "privacyRequests", "receipts", "audit", "rates", "people", "pairs", "letters", "deliveries", "tasks", "reviews", "followups", "attachments"];
var MAX_PART_BYTES = 12 * 1024 * 1024;
var COLLECTION = process.env.V1_DB_COLLECTION || "riddle_v1_workspace";
var ENV = process.env.CLOUDBASE_ENV_ID || process.env.SCB_ENV || "";
function createCloudApp() {
  if (!ENV) throw new ServiceError("SERVICE_NOT_CONFIGURED", "\u5C1A\u672A\u914D\u7F6E\u771F\u5B9E\u8D26\u53F7\u73AF\u5883");
  return import_node_sdk.default.init({ env: ENV });
}
function valueFor(store, key) {
  if (key in store.state) return store.state[key];
  return store[key];
}
function assign(store, key, value) {
  if (key in store.state) store.state[key] = value;
  else store[key] = value;
}
function decode(result) {
  const first = Array.isArray(result.data) ? result.data[0] : result.data;
  return first && typeof first === "object" && "value" in first && typeof first.value === "string" ? first.value : void 0;
}
var CloudRepository = class {
  constructor(app) {
    this.app = app;
  }
  app;
  async load(transaction) {
    const collection = transaction.collection(COLLECTION);
    const rawMeta = decode(await collection.doc("meta").get());
    const store = emptyStore();
    if (!rawMeta) return store;
    const meta = JSON.parse(rawMeta);
    if (meta.version !== 1) throw new ServiceError("SCHEMA_MISMATCH", "\u6570\u636E\u7248\u672C\u4E0D\u5339\u914D\uFF0C\u8BF7\u8054\u7CFB\u7EF4\u62A4\u4EBA\u5458");
    store.revision = meta.revision;
    store.state.clock = meta.clock;
    for (const key of PARTS) {
      const raw = decode(await collection.doc(`part-${key}`).get());
      if (raw === void 0) throw new ServiceError("DATA_INCOMPLETE", "\u4E91\u7AEF\u6570\u636E\u4E0D\u5B8C\u6574\uFF0C\u5DF2\u505C\u6B62\u8BFB\u5199");
      assign(store, key, JSON.parse(raw));
    }
    return store;
  }
  async read(operation) {
    const transaction = await this.app.database().startTransaction();
    try {
      const result = await operation(await this.load(transaction));
      await transaction.rollback();
      return result;
    } catch (error) {
      await transaction.rollback().catch(() => void 0);
      throw error;
    }
  }
  async transact(operation) {
    const transaction = await this.app.database().startTransaction();
    try {
      const store = await this.load(transaction);
      const collection = transaction.collection(COLLECTION);
      const result = await operation(store);
      for (const key of PARTS) {
        const value = JSON.stringify(valueFor(store, key));
        if (Buffer.byteLength(value, "utf8") > MAX_PART_BYTES) throw new ServiceError("CAPACITY", "\u8BD5\u70B9\u6570\u636E\u63A5\u8FD1\u5355\u6587\u6863\u5BB9\u91CF\uFF0C\u8BF7\u5148\u5F52\u6863\u518D\u7EE7\u7EED");
        await collection.doc(`part-${key}`).set({ value });
      }
      await collection.doc("meta").set({ value: JSON.stringify({ revision: store.revision, clock: store.state.clock, version: 1 }) });
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback().catch(() => void 0);
      throw error;
    }
  }
};
function createRepository(app = createCloudApp()) {
  return new CloudRepository(app);
}

// index.ts
var MAX_IMAGE = 3 * 1024 * 1024;
var MAX_ACCOUNT_IMAGES = 40;
var MAX_ACCOUNT_BYTES = 80 * 1024 * 1024;
var ORPHAN_AGE_MS = 24 * 36e5;
var asPayload = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
var validPassword = (password) => typeof password === "string" && password.length >= 8 && password.length <= 32 && [/[a-z]/, /[A-Z]/, /\d/, /[^\w]/].filter((pattern) => pattern.test(password)).length >= 3;
function requirePilotReady() {
  if (process.env.V1_PILOT_READY !== "true") throw new ServiceError("PILOT_NOT_READY", "\u6B63\u5F0F\u8BD5\u7528\u5C1A\u672A\u5F00\u653E\uFF0C\u8BF7\u5148\u4F7F\u7528\u72EC\u7ACB\u6F14\u793A\u7248");
}
function manager() {
  const envId = process.env.CLOUDBASE_ENV_ID || process.env.SCB_ENV;
  const secretId = process.env.TENCENTCLOUD_SECRETID;
  const secretKey = process.env.TENCENTCLOUD_SECRETKEY;
  if (!envId || !secretId || !secretKey) throw new ServiceError("SERVICE_NOT_CONFIGURED", "\u8D26\u53F7\u7BA1\u7406\u670D\u52A1\u5C1A\u672A\u914D\u7F6E");
  return import_manager_node.default.init({ envId, secretId, secretKey });
}
async function identityFor(app) {
  const basic = app.auth().getUserInfo();
  if (!basic.uid) throw new ServiceError("UNAUTHENTICATED", "\u8BF7\u5148\u767B\u5F55");
  const response = await app.auth().getEndUserInfo(basic.uid);
  const info = response?.userInfo ?? {};
  return { uid: basic.uid, email: info.email || info.Email || void 0, anonymous: info.isAnonymous === true || info.IsAnonymous === true };
}
function uploader(store, identity, pairId) {
  const account = getAccount(store, identity, true);
  const person = store.state.people.find((item) => item.id === identity.uid);
  if (!person) throw new ServiceError("PROFILE_MISSING", "\u8D26\u53F7\u8D44\u6599\u5C1A\u672A\u5B8C\u6210");
  if (!pairId) {
    if (account.role !== "child" || store.state.pairs.some((pair2) => pair2.status !== "ended" && pair2.childId === identity.uid)) throw new ServiceError("FORBIDDEN", "\u6B64\u5904\u53EA\u80FD\u4FDD\u5B58\u5C1A\u672A\u7ED3\u5BF9\u7684\u81EA\u6211\u4ECB\u7ECD\u56FE\u7247");
    return person;
  }
  const pair = store.state.pairs.find((item) => item.id === pairId && item.status !== "ended");
  if (!pair || !(account.role === "child" && pair.childId === identity.uid || account.role === "volunteer" && pair.volunteerId === identity.uid || account.role === "teacher" && pair.teacherId === identity.uid && pair.channel === "paper")) throw new ServiceError("FORBIDDEN", "\u4E0D\u80FD\u4E3A\u8FD9\u7EC4\u4F19\u4F34\u4E0A\u4F20\u56FE\u7247");
  return person;
}
async function upload(repository, app, identity, request) {
  const pairId = typeof request.pairId === "string" ? request.pairId : "";
  await repository.transact((store) => {
    uploader(store, identity, pairId);
    throttle(store, `upload:${identity.uid}`, (/* @__PURE__ */ new Date()).toISOString(), 3);
  });
  const name = text(request.name, "\u56FE\u7247\u540D\u79F0", 90);
  if (request.type !== "image/png" && request.type !== "image/jpeg") throw new ServiceError("INVALID_IMAGE", "\u8BF7\u9009\u62E9 PNG \u6216 JPEG \u56FE\u7247");
  const encoded = text(request.base64, "\u56FE\u7247\u6570\u636E", 45e5);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new ServiceError("INVALID_IMAGE", "\u56FE\u7247\u5185\u5BB9\u65E0\u6CD5\u8BC6\u522B");
  const input = Buffer.from(encoded, "base64");
  if (!input.length || input.length > MAX_IMAGE) throw new ServiceError("INVALID_IMAGE", "\u56FE\u7247\u4E0D\u80FD\u8D85\u8FC7 3 MiB");
  const image = (0, import_sharp.default)(input, { limitInputPixels: 2e7 });
  const metadata = await image.metadata().catch(() => {
    throw new ServiceError("INVALID_IMAGE", "\u56FE\u7247\u5185\u5BB9\u65E0\u6CD5\u8BC6\u522B");
  });
  if (!["png", "jpeg"].includes(metadata.format ?? "") || (request.type === "image/png" ? metadata.format !== "png" : metadata.format !== "jpeg")) throw new ServiceError("INVALID_IMAGE", "\u56FE\u7247\u683C\u5F0F\u4E0E\u6587\u4EF6\u7C7B\u578B\u4E0D\u4E00\u81F4");
  const clean = await image.rotate().flatten({ background: "#ffffff" }).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  if (clean.length > MAX_IMAGE) throw new ServiceError("INVALID_IMAGE", "\u5904\u7406\u540E\u7684\u56FE\u7247\u4ECD\u8D85\u8FC7 3 MiB\uFF0C\u8BF7\u5148\u538B\u7F29");
  const checkQuota = (store) => {
    const owned = store.state.attachments.filter((item) => item.ownerId === identity.uid && item.storagePath && !item.deletingAt);
    const used = owned.reduce((sum, item) => sum + (item.size ?? MAX_IMAGE), 0);
    if (owned.length >= MAX_ACCOUNT_IMAGES || used + clean.length > MAX_ACCOUNT_BYTES) throw new ServiceError("UPLOAD_QUOTA", "\u624B\u5199\u56FE\u7247\u5DF2\u8FBE\u5230\u8BD5\u7528\u5BB9\u91CF\u4E0A\u9650\uFF0C\u8BF7\u8054\u7CFB\u8FD0\u8425\u534F\u52A9\u6574\u7406");
  };
  await repository.read((store) => {
    uploader(store, identity, pairId);
    checkQuota(store);
  });
  const id = (0, import_node_crypto2.randomUUID)(), cloudPath = `private/letters/${identity.uid}/${id}.jpg`;
  const saved = await app.uploadFile({ cloudPath, fileContent: clean });
  if (!saved.fileID) throw new ServiceError("STORAGE_FAILED", "\u56FE\u7247\u6CA1\u6709\u4FDD\u5B58\u6210\u529F\uFF0C\u8BF7\u91CD\u8BD5");
  try {
    await repository.transact((store) => {
      uploader(store, identity, pairId);
      checkQuota(store);
      store.state.attachments.push({ id, pairId, ownerId: identity.uid, name, type: "image/jpeg", storagePath: saved.fileID, size: clean.length, uploadedAt: (/* @__PURE__ */ new Date()).toISOString() });
      store.revision++;
    });
  } catch (error) {
    await app.deleteFile({ fileList: [saved.fileID] }).catch(() => void 0);
    throw error;
  }
  return { id, name, type: "image/jpeg" };
}
async function download(repository, app, identity, id) {
  const attachment = await repository.read((store) => authorizeAttachment(store, identity, id));
  if (!attachment.storagePath) throw new ServiceError("NOT_FOUND", "\u56FE\u7247\u4E0D\u5B58\u5728");
  const result = await app.downloadFile({ fileID: attachment.storagePath });
  const bytes = Buffer.isBuffer(result.fileContent) ? result.fileContent : Buffer.from(result.fileContent || "");
  if (!bytes.length || bytes.length > MAX_IMAGE) throw new ServiceError("STORAGE_FAILED", "\u56FE\u7247\u8BFB\u53D6\u5931\u8D25");
  return { data: bytes.toString("base64"), type: attachment.type, name: attachment.name };
}
async function activate(repository, request) {
  const token = text(request.token, "\u9080\u8BF7\u7801", 128), username = text(request.username, "\u767B\u5F55\u8D26\u53F7", 24), password = request.password;
  if (!validPassword(password)) throw new ServiceError("INVALID_INPUT", "\u5BC6\u7801\u9700\u4E3A 8\u201432 \u4F4D\uFF0C\u5305\u542B\u81F3\u5C11\u4E09\u7C7B\u5B57\u7B26");
  const activationId = text(request.activationId, "\u6FC0\u6D3B\u7F16\u53F7", 100);
  const invite = await reserveInvite(repository, token, username, activationId);
  if (invite.status !== "used") {
    const admin = manager();
    const existing = await admin.user.describeUserList({ uidList: [invite.userId] });
    const prior = existing.Data.UserList.find((user) => user.Uid === invite.userId);
    if (prior && prior.Name !== username) throw new ServiceError("CONFLICT", "\u8D26\u53F7\u540D\u79F0\u4E0E\u9080\u8BF7\u8BB0\u5F55\u4E0D\u4E00\u81F4");
    if (!prior) {
      const created = await admin.user.createUser({ name: username, uid: invite.userId, password, type: "externalUser", nickName: invite.nickname, email: invite.email, userStatus: "ACTIVE" });
      if (created.Data?.Uid !== invite.userId) throw new ServiceError("IDENTITY_MISMATCH", "\u8EAB\u4EFD\u670D\u52A1\u8FD4\u56DE\u4E86\u4E0D\u540C\u8D26\u53F7\uFF0C\u5DF2\u505C\u6B62\u6FC0\u6D3B");
    }
  }
  return finishInvite(repository, invite.id, activationId, invite.userId);
}
async function resetChildPassword(repository, identity, payload) {
  const childId = text(payload.childId, "\u5B69\u5B50\u8D26\u53F7", 100);
  const child = await repository.read((store) => {
    const account = getAccount(store, identity, true);
    const person = store.state.people.find((item) => item.id === childId && item.role === "child");
    if (!person || person.teacherId !== identity.uid || account.role !== "teacher" || store.accounts[childId]?.status !== "active" || !person.guardianConsent) throw new ServiceError("FORBIDDEN", "\u53EA\u80FD\u534F\u52A9\u81EA\u5DF1\u8D1F\u8D23\u4E14\u4ECD\u6709\u6709\u6548\u6388\u6743\u7684\u5C0F\u670B\u53CB");
    return person;
  });
  const password = `Lr${(0, import_node_crypto2.randomBytes)(14).toString("base64url")}8!`;
  const admin = manager();
  const users = await admin.user.describeUserList({ uidList: [childId] });
  const username = users.Data.UserList.find((item) => item.Uid === childId)?.Name;
  if (!username) throw new ServiceError("NOT_FOUND", "\u8EAB\u4EFD\u8D26\u53F7\u4E0D\u5B58\u5728");
  const modified = await admin.user.modifyUser({ uid: childId, password });
  if (!modified.Data?.Success) throw new ServiceError("AUTH_FAILED", "\u6682\u65F6\u65E0\u6CD5\u91CD\u7F6E\u767B\u5F55\u5361");
  await repository.transact((store) => {
    getAccount(store, identity, true);
    if (store.state.people.find((item) => item.id === childId)?.teacherId !== identity.uid) throw new ServiceError("CONFLICT", "\u8D1F\u8D23\u8001\u5E08\u5DF2\u53D8\u5316\uFF0C\u8BF7\u8054\u7CFB\u8FD0\u8425\u91CD\u65B0\u5904\u7406");
    store.audit.push({ id: (0, import_node_crypto2.randomUUID)(), actorId: identity.uid, action: "reset-child-password", targetId: childId, at: (/* @__PURE__ */ new Date()).toISOString() });
  });
  return { username, temporaryPassword: password, nickname: child.nickname };
}
async function main(raw) {
  try {
    requirePilotReady();
    const request = asPayload(raw);
    const app = createCloudApp(), repository = createRepository(app);
    const identity = await identityFor(app);
    if (identity.anonymous) throw new ServiceError("UNAUTHENTICATED", "\u8BF7\u4F7F\u7528\u6B63\u5F0F\u8D26\u53F7\u767B\u5F55");
    let data;
    switch (request.action) {
      case "snapshot":
        data = await executeSnapshot(repository, identity);
        break;
      case "command":
        data = await executeCommand(repository, identity, { command: request.command, requestId: request.requestId, expectedRevision: request.expectedRevision });
        break;
      case "account": {
        const action = text(request.operation, "\u8D26\u53F7\u64CD\u4F5C", 80);
        const payload = asPayload(request.payload);
        if (action === "status") data = await repository.read((store) => accountStatus(store, identity));
        else if (action === "reset-child-password") data = await resetChildPassword(repository, identity, payload);
        else data = await executeAccountAction(repository, identity, action, payload);
        break;
      }
      case "upload":
        data = await upload(repository, app, identity, request);
        break;
      case "download":
        data = await download(repository, app, identity, text(request.id, "\u56FE\u7247\u7F16\u53F7", 100));
        break;
      default:
        throw new ServiceError("INVALID_ACTION", "\u4E0D\u652F\u6301\u6B64\u9879\u670D\u52A1\u64CD\u4F5C");
    }
    return { ok: true, data };
  } catch (error) {
    if (error instanceof ServiceError) return { ok: false, code: error.code, message: error.message };
    return { ok: false, code: "SERVICE_ERROR", message: "\u670D\u52A1\u6682\u65F6\u65E0\u6CD5\u5B8C\u6210\uFF0C\u8BF7\u4FDD\u7559\u8F93\u5165\u540E\u91CD\u8BD5" };
  }
}
async function activationMain(raw) {
  try {
    requirePilotReady();
    const request = asPayload(raw);
    if (request.action !== "activate-invite") throw new ServiceError("INVALID_ACTION", "\u4E0D\u652F\u6301\u6B64\u9879\u670D\u52A1\u64CD\u4F5C");
    const app = createCloudApp(), repository = createRepository(app);
    const clientIp = app.auth().getClientIP();
    await repository.transact((store) => throttle(store, `invite:${clientIp || request.token?.slice(0, 16) || "unknown"}`, (/* @__PURE__ */ new Date()).toISOString(), 12));
    return { ok: true, data: await activate(repository, request) };
  } catch (error) {
    if (error instanceof ServiceError) return { ok: false, code: error.code, message: error.message };
    return { ok: false, code: "SERVICE_ERROR", message: "\u9080\u8BF7\u6682\u65F6\u65E0\u6CD5\u6FC0\u6D3B\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5" };
  }
}
async function maintenanceMain() {
  try {
    requirePilotReady();
    const app = createCloudApp(), repository = createRepository(app);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const expired = await repository.transact((store) => {
      const referenced = new Set(store.state.letters.flatMap((letter) => [letter.attachmentId, ...(letter.submissionVersions ?? []).map((version) => version.attachmentId)]));
      const candidates = store.state.attachments.filter((item) => item.storagePath && !referenced.has(item.id) && (item.deletingAt !== void 0 || Date.parse(item.uploadedAt ?? now) < Date.parse(now) - ORPHAN_AGE_MS));
      for (const item of candidates) item.deletingAt ??= now;
      return candidates.map((item) => ({ id: item.id, storagePath: item.storagePath }));
    });
    let removed = 0;
    for (const candidate of expired) {
      const deleted = await app.deleteFile({ fileList: [candidate.storagePath] });
      if (deleted.fileList.some((file) => file.code !== "SUCCESS")) continue;
      await repository.transact((store) => {
        const referenced = store.state.letters.some((letter) => letter.attachmentId === candidate.id || letter.submissionVersions?.some((version) => version.attachmentId === candidate.id));
        if (referenced) throw new ServiceError("CONFLICT", "\u9644\u4EF6\u5728\u6E05\u7406\u65F6\u88AB\u4F7F\u7528");
        store.state.attachments = store.state.attachments.filter((item) => item.id !== candidate.id);
        store.revision++;
      });
      removed++;
    }
    return { ok: true, data: { candidates: expired.length, removed } };
  } catch {
    return { ok: false, code: "MAINTENANCE_FAILED", message: "\u9644\u4EF6\u6E05\u7406\u672A\u5B8C\u6210\uFF1B\u8BF7\u68C0\u67E5\u4EFB\u52A1\u65E5\u5FD7\u5E76\u91CD\u8BD5" };
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activationMain,
  main,
  maintenanceMain
});
