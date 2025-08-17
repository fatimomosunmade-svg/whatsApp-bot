import makeWASocket, { useMultiFileAuthState } from "@whiskeysockets/baileys"

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info')

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', ({ connection }) => {
    if (connection === 'open') {
      console.log("✅ WhatsApp bot connected successfully!")
    } else if (connection === 'close') {
      console.log("❌ Connection closed, reconnecting...")
      startBot()
    }
  })

  sock.ev.on('messages.upsert', async m => {
    const msg = m.messages[0]
    if (!msg.key.fromMe && msg.message?.conversation) {
      const text = msg.message.conversation.toLowerCase()
      console.log("📩 New message:", text)

      if (text === 'hi') {
        await sock.sendMessage(msg.key.remoteJid, { text: "Hey 👋, I'm alive on Render!" })
      }
    }
  })
}

startBot()
