// index.js
import pino from "pino"
import baileys from "@whiskeysockets/baileys"
import QRCode from "qrcode"
import fs from "fs"
import axios from "axios"
import ytdl from "ytdl-core"
import yts from "yt-search"

const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = baileys

// Admin number & API key from environment
const ADMIN_NUMBER = process.env.ADMIN_NUMBER
const OPENWEATHER_KEY = process.env.OPENWEATHER_KEY

// Premium users file
const PREMIUM_FILE = "premium.json"
if (!fs.existsSync(PREMIUM_FILE)) fs.writeFileSync(PREMIUM_FILE, JSON.stringify([]))

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info")
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" })
  })

  // ✅ Show QR as ASCII in logs
  sock.ev.on("connection.update", (update) => {
    const { connection, qr } = update
    if (qr) {
      QRCode.toString(qr, { type: "terminal" }, (err, url) => {
        if (err) return console.error(err)
        console.log(url)
      })
    }

    if (connection === "open") {
      console.log("✅ WhatsApp connected successfully!")
    }
  })

  sock.ev.on("creds.update", saveCreds)

  // Example handler: respond to "ping"
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const m = messages[0]
    if (!m.message) return

    const from = m.key.remoteJid
    const text = m.message.conversation || m.message.extendedTextMessage?.text

    if (!text) return

    if (text.toLowerCase() === "ping") {
      await sock.sendMessage(from, { text: "pong ✅" })
    }

    // Example: Weather
    if (text.startsWith("!weather ")) {
      const city = text.split(" ")[1]
      try {
        const res = await axios.get(
          `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${OPENWEATHER_KEY}&units=metric`
        )
        const data = res.data
        const reply = `🌤 Weather in *${data.name}*\nTemp: ${data.main.temp}°C\nCondition: ${data.weather[0].description}`
        await sock.sendMessage(from, { text: reply })
      } catch (err) {
        await sock.sendMessage(from, { text: "❌ Could not fetch weather." })
      }
    }
  })
}

startBot()
