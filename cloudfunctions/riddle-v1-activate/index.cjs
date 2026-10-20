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

// activation.ts
var activation_exports = {};
__export(activation_exports, {
  main: () => activationMain
});
module.exports = __toCommonJS(activation_exports);

// index.ts
var import_sharp = __toESM(require("sharp"), 1);
var import_manager_node = __toESM(require("@cloudbase/manager-node"), 1);

// core.ts
var import_node_crypto = require("node:crypto");
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  main
});
