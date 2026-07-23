require("dotenv").config();
const { REST, Routes } = require("discord.js");
const { commands } = require("./src/commands");

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error("DISCORD_TOKEN, CLIENT_ID를 .env 파일에 먼저 채워주세요.");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
        body: commands,
      });
      console.log(`서버(${GUILD_ID})에 명령어 등록 완료! (즉시 반영됩니다)`);
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), {
        body: commands,
      });
      console.log("글로벌 명령어 등록 완료! (반영까지 최대 1시간 소요될 수 있어요)");
    }
  } catch (err) {
    console.error("명령어 등록 중 오류:", err);
  }
})();
