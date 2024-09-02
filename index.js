const { default: makeWASocket, useSingleFileAuthState } = require('@whiskeysockets/baileys');
const fetch = require('node-fetch');
const { Boom } = require('@hapi/boom');
const { unlinkSync } = require('fs');
const { writeFile } = require('fs/promises');

// WhatsApp Auth
const { state, saveState } = useSingleFileAuthState('auth_info.json');

async function downloadTikTokVideo(url) {
    const apiUrl = `https://www.tikwm.com/api?url=${encodeURIComponent(url)}`;
    const response = await fetch(apiUrl);
    const json = await response.json();

    if (json.data && json.data.play) {
        const videoUrl = json.data.play;
        const videoResponse = await fetch(videoUrl);
        const videoBuffer = await videoResponse.buffer();
        const videoFileName = `tiktok_${Date.now()}.mp4`;
        await writeFile(videoFileName, videoBuffer);
        return videoFileName;
    } else {
        throw new Error('Failed to download video');
    }
}

async function startWhatsAppBot() {
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
    });

    sock.ev.on('creds.update', saveState);

    sock.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0];
        if (!message.message) return;

        try {
            const msgType = Object.keys(message.message)[0];
            if (msgType === 'conversation' || msgType === 'extendedTextMessage') {
                const chat = message.key.remoteJid;
                const text = message.message.conversation || message.message.extendedTextMessage.text;

                if (text.startsWith('http') && text.includes('tiktok.com')) {
                    const videoFile = await downloadTikTokVideo(text);
                    await sock.sendMessage(chat, { video: { url: videoFile } });
                    unlinkSync(videoFile);
                } else {
                    await sock.sendMessage(chat, { text: 'Please send a valid TikTok link.' });
                }
            }
        } catch (err) {
            console.error('Error:', err);
        }
    });
}

startWhatsAppBot();
