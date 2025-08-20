import * as baileys from "@whiskeysockets/baileys";
const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = baileys;

import P from "pino";
import axios from "axios";
import moment from "moment";
import express from "express";

// === CONFIG ===
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;

// === Admin / Premium setup ===
const admins = ["2348086850026"]; // Your WhatsApp ID
let premiumUsers = []; // Stores premium users dynamically
let freemiumUsers = []; // Optional freemium tier

// === Banner ===
console.log(`
=============================
   🚀 WhatsApp Bot Online 🚀
   Commands:
   .ping       -> Pong!
   .time       -> Current Time
   .weather <city>
   Admin: .adduser .removeuser .listpremium .showheavyusers
   Everyone: .kick <number>
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
    if (!city) return await sock.sendMessage(from, { text: "⚠️ Usage: .weather <city>" });
    if (!WEATHER_API_KEY) return await sock.sendMessage(from, { text: "❌ WEATHER_API_KEY not set!" });

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
    } catch {
      await sock.sendMessage(from, { text: "❌ City not found!" });
    }
  },

  adduser: async (sock, from, args, sender) => {
    if (!admins.includes(sender)) return;
    const newUser = args[0];
    if (!newUser) return await sock.sendMessage(from, { text: "⚠️ Usage: .adduser <number>" });
    if (!premiumUsers.includes(newUser)) premiumUsers.push(newUser);
    await sock.sendMessage(from, { text: `✅ Added ${newUser} to premium users!` });
  },

  removeuser: async (sock, from, args, sender) => {
    if (!admins.includes(sender)) return;
    const user = args[0];
    if (!user) return await sock.sendMessage(from, { text: "⚠️ Usage: .removeuser <number>" });
    premiumUsers = premiumUsers.filter(u => u !== user);
    await sock.sendMessage(from, { text: `✅ Removed ${user} from premium users!` });
  },

  listpremium: async (sock, from, sender) => {
    if (!admins.includes(sender)) return;
    await sock.sendMessage(from, { text: `🌟 Premium Users:\n${premiumUsers.join("\n") || "None"}` });
  },

  showheavyusers: async (sock, from, sender) => {
    if (!admins.includes(sender)) return;
    // Placeholder for heavy users logic
    await sock.sendMessage(from, { text: "⚡ Heavy users feature coming soon!" });
  },

  kick: async (sock, from, args) => {
    const target = args[0]; // e.g. 080xxxxxxx
    await sock.sendMessage(from, { text: `⚠️ Tried to kick ${target} (logic not implemented yet)` });
  }
};

// === Start WhatsApp Bot safely ===
async function startBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");
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

      if (!body.startsWith(".")) return; // Only commands

      const args = body.slice(1).trim().split(/ +/);
      const cmdName = args.shift().toLowerCase();
      const sender = m.key.participant || m.key.remoteJid;

      const cmd = commands[cmdName];
      if (cmd) {
        try {
          await cmd(sock, from, args, sender);
        } catch (e) {
          await sock.sendMessage(from, { text: "⚠️ Error running command!" });
          console.error(e);
        }
      }
    });

    console.log("✅ WhatsApp socket connected successfully!");
  } catch (err) {
    console.error("❌ Failed to start WhatsApp socket:", err);
    console.log("⏳ Retrying in 5 seconds...");
    setTimeout(startBot, 5000);
  }
}

startBot();

// === Dummy webserver for Render ===
const app = express();
app.get("/", (req, res) => res.send("🚀 WhatsApp Bot is running!"));
app.listen(process.env.PORT || 3000, () => {
  console.log("✅ Dummy server running on port " + (process.env.PORT || 3000));
});
