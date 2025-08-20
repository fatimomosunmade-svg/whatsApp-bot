import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import P from "pino";
import axios from "axios";
import moment from "moment";

// === CONFIG ===
const WEATHER_API_KEY = "0bfc48fa9d8a1575af7575b80cb41468";

// === Banner ===
console.log(`
=============================
   🚀 WhizBot Online 🚀
   Commands:
   .ping    -> Pong!
   .time    -> Current Time
   .weather <city>
=============================
`);

// === Command Handler ===
const commands = {
  ping: async (sock, from) => {
    await sock.sendMessage(from, { text: "🏓 Pong!" });
  },

  time: async (sock, from) => {
    const now = moment().format("dddd, MMMM Do YYYY, h:mm:ss A");
    await sock.sendMessage(from, { text: `⏰ Current time: ${now}` });
  },

  weather: async (sock, from, args) => {
    const city = args[0];
    if (!city) {
      await sock.sendMessage(from, { text: "⚠️ Usage: .weather <city>" });
      return;
    }
    try {
      const res = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${WEATHER_API_KEY}&units=metric`
      );
      const data = res.data;
      const reply = `🌍 Weather in ${data.name}:
- ${data.weather[0].description}
- 🌡 Temp: ${data.main.temp}°C
- 💨 Wind: ${data.wind.speed} m/s
- 💧 Humidity: ${data.main.humidity}%`;
      await sock.sendMessage(from, { text: reply });
    } catch (e) {
      await sock.sendMessage(from, { text: "❌ City not found!" });
    }
  }
};

// === Start WhatsApp Bot ===
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    printQRInTerminal: true,
    auth: state,
    logger: P({ level: "silent" })
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const m = messages[0];
    if (!m.message || !m.key.remoteJid) return;

    const from = m.key.remoteJid;
    const body =
      m.message.conversation ||
      m.message.extendedTextMessage?.text ||
      "";

    if (!body.startsWith(".")) return; // Only commands start with "."

    const args = body.slice(1).trim().split(/ +/);
    const cmdName = args.shift().toLowerCase();

    const cmd = commands[cmdName];
    if (cmd) {
      try {
        await cmd(sock, from, args);
      } catch (e) {
        await sock.sendMessage(from, { text: "⚠️ Error running command!" });
        console.error(e);
      }
    }
  });
}

startBot();
