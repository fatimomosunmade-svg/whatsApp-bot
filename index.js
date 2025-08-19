// index.js (ESM)
import pino from "pino"
import baileys from "@whiskeysockets/baileys"
import QRCode from "qrcode"
import fs from "fs"
import axios from "axios"
import ytdl from "ytdl-core"
import yts from "yt-search"

const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = baileys

// Admin number
const ADMIN_NUMBER = process.env.ADMIN_NUMBER

// JSON storage for premium users
const PREMIUM_FILE = "premium.json"
if (!fs.existsSync(PREMIUM_FILE)) fs.writeFileSync(PREMIUM_FILE, JSON.stringify([]))

// OpenWeather API key
const OPENWEATHER_KEY = process.env.OPENWEATHER_KEY

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info")
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" })
  })

  sock.ev.on("creds.update", saveCreds)

  sock.ev.on("connection.update", async (update) => {
    const { connection, qr } = update
    if (qr) {
      // Save QR as PNG for Render / remote servers
      await QRCode.toFile("qr.png", qr)
      console.log("📌 QR code saved as qr.png. Open and scan to connect your bot.")
    }
    if (connection === "open") console.log("✅ Connected")
    if (connection === "close") {
      console.log("🔁 Connection closed, reconnecting...")
      startBot()
    }
  })

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages?.[0]
    if (!msg?.message) return
    const from = msg.key.remoteJid
    const number = msg.key.participant || msg.key.remoteJid.split("@")[0]
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      ""

    // Load premium users
    let premiumUsers = JSON.parse(fs.readFileSync(PREMIUM_FILE))

    const isAdmin = number === ADMIN_NUMBER

    // ------------------------ Admin Commands ------------------------
    if (isAdmin && text.startsWith(".adduser")) {
      const n = text.split(" ")[1]
      if (!premiumUsers.includes(n)) {
        premiumUsers.push(n)
        fs.writeFileSync(PREMIUM_FILE, JSON.stringify(premiumUsers))
        await sock.sendMessage(from, { text: `✅ ${n} added to premium users.` })
      } else {
        await sock.sendMessage(from, { text: `${n} is already premium.` })
      }
      return
    }

    if (isAdmin && text.startsWith(".removeuser")) {
      const n = text.split(" ")[1]
      premiumUsers = premiumUsers.filter(u => u !== n)
      fs.writeFileSync(PREMIUM_FILE, JSON.stringify(premiumUsers))
      await sock.sendMessage(from, { text: `✅ ${n} removed from premium users.` })
      return
    }

    if (isAdmin && text === ".list premium") {
      await sock.sendMessage(from, { text: "💎 Premium Users:\n" + (premiumUsers.join("\n") || "No premium users yet") })
      return
    }

    // ------------------------ Freemium Commands ------------------------
    if (text === ".help") {
      await sock.sendMessage(from, {
        text:
`🌟✨ Welcome to WhizBot Zone ✨🌟

🆓 Freemium Commands:
.help
.menu
.time
.weather <city>
.song <title>

💎 Premium Commands:
.download <url>
.lyrics <song>
.search <query>
.ai <prompt>

👑 Admin Commands (Bot Owner Only):
.adduser, .removeuser, .list premium

To use a command, type it starting with a dot .`
      })
      return
    }

    if (text === ".menu") {
      await sock.sendMessage(from, {
        text:
`📋 Menu - WhizBot Zone

🆓 Freemium:
.help, .menu, .time, .weather <city>, .song <title>

💎 Premium:
.download <url>, .lyrics <song>, .search <query>, .ai <prompt>

👑 Admin: .adduser, .removeuser, .list premium`
      })
      return
    }

    if (text === ".time") {
      const now = new Date()
      await sock.sendMessage(from, { text: `🕒 Current server time: ${now.toLocaleString()}` })
      return
    }

    if (text.startsWith(".weather")) {
      const city = text.split(" ").slice(1).join(" ")
      if (!city) return sock.sendMessage(from, { text: "❌ Please provide a city. Usage: .weather Lagos" })
      try {
        const res = await axios.get(`http://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${OPENWEATHER_KEY}&units=metric`)
        const w = res.data
        const msgText = `🌤 Weather in ${w.name}:\nTemperature: ${w.main.temp}°C\nFeels like: ${w.main.feels_like}°C\nCondition: ${w.weather[0].description}`
        await sock.sendMessage(from, { text: msgText })
      } catch (e) {
        await sock.sendMessage(from, { text: "❌ Could not fetch weather. Make sure city name is correct." })
      }
      return
    }

    // ------------------------ Freemium Song Command ------------------------
    if (text.startsWith(".song")) {
      const query = text.split(" ").slice(1).join(" ")
      if (!query) return sock.sendMessage(from, { text: "❌ Usage: .song <title>" })

      const msg = await sock.sendMessage(from, { text: "🎶 Fetching your song, please wait..." })

      try {
        const searchResult = await yts(query)
        if (!searchResult || !searchResult.videos.length) {
          return sock.sendMessage(from, { text: "❌ No results found." })
        }
        const video = searchResult.videos[0]

        const stream = ytdl(video.url, { filter: "audioonly" })
        const filePath = `./${video.title}.mp3`
        const writeStream = fs.createWriteStream(filePath)
        stream.pipe(writeStream)

        writeStream.on("finish", async () => {
          await sock.sendMessage(from, { delete: { remoteJid: from, id: msg.key.id } })

          await sock.sendMessage(from, {
            audio: fs.readFileSync(filePath),
            mimetype: "audio/mpeg",
            fileName: `${video.title}.mp3`
          })

          fs.unlinkSync(filePath)
        })

      } catch (e) {
        await sock.sendMessage(from, { text: "❌ Could not fetch the song." })
        console.log(e)
      }

      return
    }

  }) // messages.upsert
}

startBot()

