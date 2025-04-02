const vosk = require('vosk');
const fs = require('fs');
const { execSync } = require('child_process');

const MODEL_PATH = 'model'; // Chemin vers le modèle Vosk
if (!fs.existsSync(MODEL_PATH)) {
    console.error("Modèle Vosk introuvable. Téléchargez-le depuis https://alphacephei.com/vosk/models");
    process.exit();
}

vosk.setLogLevel(0);
const model = new vosk.Model(MODEL_PATH);

async function processVoiceMessage(media) {
    try {
        // Convertir l'audio en format WAV 16kHz mono
        const audioPath = 'temp_audio.ogg';
        const wavPath = 'temp_audio.wav';
        
        fs.writeFileSync(audioPath, media.data, 'base64');
        
        execSync(`ffmpeg -i ${audioPath} -ar 16000 -ac 1 ${wavPath}`);
        
        // Reconnaissance vocale
        const rec = new vosk.Recognizer({ model: model, sampleRate: 16000 });
        const stream = fs.createReadStream(wavPath);
        
        let text = '';
        stream.on('data', (chunk) => {
            if (rec.acceptWaveform(chunk)) {
                text += rec.result().text;
            }
        });
        
        return new Promise((resolve) => {
            stream.on('end', () => {
                text += rec.finalResult().text;
                fs.unlinkSync(audioPath);
                fs.unlinkSync(wavPath);
                resolve(text.trim() || "Je n'ai pas compris le message vocal");
            });
        });
    } catch (error) {
        console.error("Erreur de traitement vocal:", error);
        return "Erreur de traitement du message vocal";
    }
}

module.exports = { processVoiceMessage };