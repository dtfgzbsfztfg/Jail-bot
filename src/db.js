// 간단한 JSON 파일 기반 저장소.
// 외부 데이터베이스 없이 동작하도록 만들었습니다. (data.json 에 전부 저장)

const fs = require("fs");
const path = require("path");

// Railway 등에서 Volume을 마운트한 경로가 있다면 DATA_DIR 환경변수로 지정하세요.
// (예: Volume 마운트 경로가 /data 라면 DATA_DIR=/data)
// 지정하지 않으면 프로젝트 폴더에 저장되며, Railway는 재배포 시 이 파일이 초기화됩니다.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..");
const DB_PATH = path.join(DATA_DIR, "data.json");

function loadRaw() {
  if (!fs.existsSync(DB_PATH)) {
    return { guilds: {} };
  }
  try {
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("data.json 을 읽는 중 오류가 발생했습니다. 새로 시작합니다.", err);
    return { guilds: {} };
  }
}

function saveRaw(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
}

const DEFAULT_CONFIG = {
  threshold: 3, // 이 횟수만큼 경고를 받으면 감옥행
  visitLimit: 1, // 한 사람이 같은 수감자를 면회할 수 있는 횟수
  staffRoleId: null, // 관리 명령어를 쓸 수 있는 역할(없으면 관리자 권한자만 가능)
  prisonerRoleId: null, // "죄수" 역할 ID
  categoryId: null, // 감옥 채널들이 들어갈 카테고리 ID
};

function ensureGuild(data, guildId) {
  if (!data.guilds[guildId]) {
    data.guilds[guildId] = {
      config: { ...DEFAULT_CONFIG },
      warns: {}, // userId -> count
      jails: {}, // userId -> { channelId, jailedAt }
      visits: {}, // "jailedId_visitorId" -> count
    };
  }
  // 예전 버전 데이터에 새 필드가 없을 경우 대비
  data.guilds[guildId].config = { ...DEFAULT_CONFIG, ...data.guilds[guildId].config };
  return data.guilds[guildId];
}

class GuildStore {
  constructor(guildId) {
    this.guildId = guildId;
  }

  _read() {
    const data = loadRaw();
    return { data, guild: ensureGuild(data, this.guildId) };
  }

  _write(data) {
    saveRaw(data);
  }

  getConfig() {
    return this._read().guild.config;
  }

  setConfig(patch) {
    const { data, guild } = this._read();
    guild.config = { ...guild.config, ...patch };
    this._write(data);
    return guild.config;
  }

  getWarns(userId) {
    const { guild } = this._read();
    return guild.warns[userId] || 0;
  }

  addWarn(userId) {
    const { data, guild } = this._read();
    guild.warns[userId] = (guild.warns[userId] || 0) + 1;
    this._write(data);
    return guild.warns[userId];
  }

  resetWarns(userId) {
    const { data, guild } = this._read();
    guild.warns[userId] = 0;
    this._write(data);
  }

  setJail(userId, channelId) {
    const { data, guild } = this._read();
    guild.jails[userId] = { channelId, jailedAt: Date.now() };
    this._write(data);
  }

  getJail(userId) {
    const { guild } = this._read();
    return guild.jails[userId] || null;
  }

  removeJail(userId) {
    const { data, guild } = this._read();
    delete guild.jails[userId];
    // 해당 유저 관련 면회 기록도 정리
    for (const key of Object.keys(guild.visits)) {
      if (key.startsWith(`${userId}_`)) {
        delete guild.visits[key];
      }
    }
    this._write(data);
  }

  getVisitCount(jailedUserId, visitorId) {
    const { guild } = this._read();
    return guild.visits[`${jailedUserId}_${visitorId}`] || 0;
  }

  addVisit(jailedUserId, visitorId) {
    const { data, guild } = this._read();
    const key = `${jailedUserId}_${visitorId}`;
    guild.visits[key] = (guild.visits[key] || 0) + 1;
    this._write(data);
    return guild.visits[key];
  }

  allJails() {
    const { guild } = this._read();
    return guild.jails;
  }
}

module.exports = { GuildStore };
