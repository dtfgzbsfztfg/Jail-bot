const { SlashCommandBuilder } = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("[스태프] 유저에게 규칙 위반 경고를 1회 부여합니다.")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("경고를 줄 유저").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("위반 사유").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("warnlist")
    .setDescription("[스태프] 유저의 현재 경고 횟수를 확인합니다.")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("확인할 유저").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("resetwarns")
    .setDescription("[스태프] 유저의 경고 횟수를 0으로 초기화합니다.")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("초기화할 유저").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("release")
    .setDescription("[스태프] 유저를 감옥에서 즉시 석방합니다.")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("석방할 유저").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("visit")
    .setDescription("감옥에 있는 유저를 면회합니다. (횟수 제한 있음)")
    .addUserOption((opt) =>
      opt.setName("target").setDescription("면회할 수감자").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("visitstatus")
    .setDescription("특정 수감자에 대한 내 남은 면회 횟수를 확인합니다.")
    .addUserOption((opt) =>
      opt.setName("target").setDescription("확인할 수감자").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("jail-config")
    .setDescription("[스태프] 몇 번 위반 시 감옥에 가는지 설정합니다.")
    .addIntegerOption((opt) =>
      opt
        .setName("threshold")
        .setDescription("이 횟수만큼 경고를 받으면 감옥행")
        .setRequired(true)
        .setMinValue(1)
    ),

  new SlashCommandBuilder()
    .setName("visit-config")
    .setDescription("[스태프] 한 사람당 면회 가능 횟수를 설정합니다.")
    .addIntegerOption((opt) =>
      opt
        .setName("limit")
        .setDescription("한 수감자당 한 사람이 면회 가능한 횟수")
        .setRequired(true)
        .setMinValue(1)
    ),

  new SlashCommandBuilder()
    .setName("staff-role")
    .setDescription("[관리자] 감옥 명령어를 사용할 수 있는 스태프 역할을 지정합니다.")
    .addRoleOption((opt) =>
      opt.setName("role").setDescription("스태프 역할").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("jail-settings")
    .setDescription("현재 감옥/면회 설정을 확인합니다."),
].map((c) => c.toJSON());

module.exports = { commands };
