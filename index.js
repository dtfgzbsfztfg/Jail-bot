require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");
const { GuildStore } = require("./src/db");

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const JAIL_CATEGORY_NAME = "🔒 감옥";
const PRISONER_ROLE_NAME = "죄수";

// ---------- 권한 체크 ----------
function isStaff(interaction, config) {
  const member = interaction.member;
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (config.staffRoleId && member.roles.cache.has(config.staffRoleId)) {
    return true;
  }
  return false;
}

function isAdmin(interaction) {
  return interaction.member?.permissions.has(PermissionFlagsBits.Administrator);
}

// ---------- 감옥 인프라 준비 ----------
async function ensurePrisonerRole(guild, store) {
  const config = store.getConfig();
  if (config.prisonerRoleId) {
    const existing = guild.roles.cache.get(config.prisonerRoleId);
    if (existing) return existing;
  }
  let role = guild.roles.cache.find((r) => r.name === PRISONER_ROLE_NAME);
  if (!role) {
    role = await guild.roles.create({
      name: PRISONER_ROLE_NAME,
      color: "DarkRed",
      reason: "감옥 봇: 죄수 역할 생성",
      permissions: [],
    });
  }
  store.setConfig({ prisonerRoleId: role.id });
  return role;
}

async function ensureJailCategory(guild, store) {
  const config = store.getConfig();
  if (config.categoryId) {
    const existing = guild.channels.cache.get(config.categoryId);
    if (existing) return existing;
  }
  let category = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name === JAIL_CATEGORY_NAME
  );
  if (!category) {
    category = await guild.channels.create({
      name: JAIL_CATEGORY_NAME,
      type: ChannelType.GuildCategory,
      reason: "감옥 봇: 감옥 카테고리 생성",
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      ],
    });
  }
  store.setConfig({ categoryId: category.id });
  return category;
}

// 죄수 역할이 감옥 카테고리 밖의 채널을 보지 못하도록 잠급니다.
async function lockOtherChannelsFor(guild, prisonerRole, jailCategoryId) {
  const channels = guild.channels.cache.filter(
    (c) => c.parentId !== jailCategoryId && c.id !== jailCategoryId
  );
  for (const channel of channels.values()) {
    if (!channel.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.ManageRoles)) {
      continue;
    }
    try {
      await channel.permissionOverwrites.edit(prisonerRole.id, {
        ViewChannel: false,
      });
    } catch (err) {
      // 권한 부족 등으로 실패한 채널은 건너뜁니다.
    }
  }
}

async function jailMember(guild, store, member) {
  const config = store.getConfig();
  const prisonerRole = await ensurePrisonerRole(guild, store);
  const category = await ensureJailCategory(guild, store);

  const safeName = member.user.username
    .toLowerCase()
    .replace(/[^a-z0-9가-힣-]/g, "")
    .slice(0, 20) || "user";

  const jailChannel = await guild.channels.create({
    name: `감옥-${safeName}`,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `${member.user.tag} 님의 감옥방입니다.`,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: prisonerRole.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: member.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
      ...(config.staffRoleId
        ? [
            {
              id: config.staffRoleId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
              ],
            },
          ]
        : []),
    ],
  });

  await member.roles.add(prisonerRole).catch(() => {});
  await lockOtherChannelsFor(guild, prisonerRole, category.id);

  store.setJail(member.id, jailChannel.id);

  await jailChannel.send(
    `🔒 ${member} 님이 규칙을 ${config.threshold}회 위반하여 이곳에 수감되었습니다.\n` +
      `다른 사람들은 \`/visit\` 명령어로 면회를 신청할 수 있으며, 한 사람당 최대 ${config.visitLimit}회까지 가능합니다.`
  );

  return jailChannel;
}

async function releaseMember(guild, store, userId) {
  const jail = store.getJail(userId);
  const config = store.getConfig();

  const member = await guild.members.fetch(userId).catch(() => null);
  if (member && config.prisonerRoleId) {
    await member.roles.remove(config.prisonerRoleId).catch(() => {});
  }

  if (jail) {
    const channel = guild.channels.cache.get(jail.channelId);
    if (channel) {
      await channel.send("🔓 석방되었습니다. 이 채널은 곧 삭제됩니다.").catch(() => {});
      setTimeout(() => channel.delete().catch(() => {}), 4000);
    }
  }

  store.removeJail(userId);
}

// ---------- 이벤트 ----------
client.once("ready", () => {
  console.log(`로그인 완료: ${client.user.tag}`);
});

// 새로 만들어지는 채널도 자동으로 죄수 역할에게 잠기도록 처리
client.on("channelCreate", async (channel) => {
  if (!channel.guild) return;
  const store = new GuildStore(channel.guild.id);
  const config = store.getConfig();
  if (!config.prisonerRoleId) return;
  if (channel.parentId === config.categoryId) return; // 감옥 채널 자체는 제외
  try {
    await channel.permissionOverwrites.edit(config.prisonerRoleId, {
      ViewChannel: false,
    });
  } catch (err) {
    // 권한 부족 시 무시
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (!interaction.guild) {
    return interaction.reply({ content: "이 명령어는 서버 안에서만 사용할 수 있어요.", ephemeral: true });
  }

  const store = new GuildStore(interaction.guild.id);
  const config = store.getConfig();

  try {
    switch (interaction.commandName) {
      case "warn": {
        if (!isStaff(interaction, config)) {
          return interaction.reply({ content: "이 명령어를 사용할 권한이 없어요.", ephemeral: true });
        }
        const target = interaction.options.getUser("user", true);
        const reason = interaction.options.getString("reason") || "사유 미기재";

        if (target.bot) {
          return interaction.reply({ content: "봇에게는 경고를 줄 수 없어요.", ephemeral: true });
        }

        const jail = store.getJail(target.id);
        if (jail) {
          return interaction.reply({ content: "해당 유저는 이미 감옥에 있어요.", ephemeral: true });
        }

        const count = store.addWarn(target.id);
        await interaction.reply(
          `⚠️ ${target} 님에게 경고를 부여했습니다. (사유: ${reason})\n현재 경고: ${count}/${config.threshold}회`
        );

        if (count >= config.threshold) {
          const member = await interaction.guild.members.fetch(target.id).catch(() => null);
          if (member) {
            const jailChannel = await jailMember(interaction.guild, store, member);
            store.resetWarns(target.id);
            await interaction.followUp(
              `🚨 ${target} 님이 기준치(${config.threshold}회)에 도달하여 ${jailChannel} 에 수감되었습니다.`
            );
          }
        }
        break;
      }

      case "warnlist": {
        if (!isStaff(interaction, config)) {
          return interaction.reply({ content: "이 명령어를 사용할 권한이 없어요.", ephemeral: true });
        }
        const target = interaction.options.getUser("user", true);
        const count = store.getWarns(target.id);
        const jail = store.getJail(target.id);
        await interaction.reply({
          content: `${target} 님의 현재 경고: ${count}/${config.threshold}회${jail ? "\n(현재 감옥에 수감 중)" : ""}`,
          ephemeral: true,
        });
        break;
      }

      case "resetwarns": {
        if (!isStaff(interaction, config)) {
          return interaction.reply({ content: "이 명령어를 사용할 권한이 없어요.", ephemeral: true });
        }
        const target = interaction.options.getUser("user", true);
        store.resetWarns(target.id);
        await interaction.reply(`${target} 님의 경고를 0으로 초기화했습니다.`);
        break;
      }

      case "release": {
        if (!isStaff(interaction, config)) {
          return interaction.reply({ content: "이 명령어를 사용할 권한이 없어요.", ephemeral: true });
        }
        const target = interaction.options.getUser("user", true);
        if (!store.getJail(target.id)) {
          return interaction.reply({ content: "해당 유저는 감옥에 있지 않아요.", ephemeral: true });
        }
        await interaction.reply(`${target} 님을 석방합니다.`);
        await releaseMember(interaction.guild, store, target.id);
        break;
      }

      case "visit": {
        const target = interaction.options.getUser("target", true);
        if (target.id === interaction.user.id) {
          return interaction.reply({ content: "본인을 면회할 수는 없어요.", ephemeral: true });
        }
        const jail = store.getJail(target.id);
        if (!jail) {
          return interaction.reply({ content: "해당 유저는 감옥에 있지 않아요.", ephemeral: true });
        }
        const used = store.getVisitCount(target.id, interaction.user.id);
        if (used >= config.visitLimit) {
          return interaction.reply({
            content: `이미 면회 가능 횟수(${config.visitLimit}회)를 모두 사용했어요.`,
            ephemeral: true,
          });
        }
        const channel = interaction.guild.channels.cache.get(jail.channelId);
        if (!channel) {
          return interaction.reply({ content: "감옥 채널을 찾을 수 없어요. 관리자에게 문의해주세요.", ephemeral: true });
        }
        await channel.permissionOverwrites.edit(interaction.user.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
        });
        const newCount = store.addVisit(target.id, interaction.user.id);
        await interaction.reply(
          `✅ 면회가 승인되었습니다. ${channel} 채널에 입장할 수 있어요. (사용: ${newCount}/${config.visitLimit}회)`
        );
        await channel.send(`🚪 ${interaction.user} 님이 면회를 왔습니다.`).catch(() => {});
        break;
      }

      case "visitstatus": {
        const target = interaction.options.getUser("target", true);
        const used = store.getVisitCount(target.id, interaction.user.id);
        await interaction.reply({
          content: `${target} 님에 대한 내 면회 사용 횟수: ${used}/${config.visitLimit}회`,
          ephemeral: true,
        });
        break;
      }

      case "jail-config": {
        if (!isStaff(interaction, config)) {
          return interaction.reply({ content: "이 명령어를 사용할 권한이 없어요.", ephemeral: true });
        }
        const threshold = interaction.options.getInteger("threshold", true);
        store.setConfig({ threshold });
        await interaction.reply(`감옥행 기준을 ${threshold}회 위반으로 설정했습니다.`);
        break;
      }

      case "visit-config": {
        if (!isStaff(interaction, config)) {
          return interaction.reply({ content: "이 명령어를 사용할 권한이 없어요.", ephemeral: true });
        }
        const limit = interaction.options.getInteger("limit", true);
        store.setConfig({ visitLimit: limit });
        await interaction.reply(`면회 제한 횟수를 1인당 ${limit}회로 설정했습니다.`);
        break;
      }

      case "staff-role": {
        if (!isAdmin(interaction)) {
          return interaction.reply({ content: "이 명령어는 서버 관리자만 사용할 수 있어요.", ephemeral: true });
        }
        const role = interaction.options.getRole("role", true);
        store.setConfig({ staffRoleId: role.id });
        await interaction.reply(`스태프 역할을 ${role} 로 설정했습니다.`);
        break;
      }

      case "jail-settings": {
        const c = store.getConfig();
        await interaction.reply({
          content:
            `📋 현재 설정\n` +
            `- 감옥행 기준: ${c.threshold}회 위반\n` +
            `- 면회 제한: 1인당 ${c.visitLimit}회\n` +
            `- 스태프 역할: ${c.staffRoleId ? `<@&${c.staffRoleId}>` : "설정 안 됨 (관리자만 사용 가능)"}`,
          ephemeral: true,
        });
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error(err);
    const payload = { content: "명령어 처리 중 오류가 발생했습니다.", ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
