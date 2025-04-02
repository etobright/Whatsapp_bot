const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Modules pour les nouvelles fonctionnalités
const { processVoiceMessage } = require('./voice.js');
const { setupProactiveNotifications } = require('./notifications.js');
const { understandNaturalLanguage } = require('./nlp.js');
const { detectLanguage, translateText } = require('./i18n.js');

// Configuration du client WhatsApp
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: chromePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Structure des menus
const options = {
    "1": {
        name: "Problèmes de paiement",
        suboptions: [
            "1️⃣ Reçu non généré",
            "2️⃣ Nom incorrect sur le reçu",
            "3️⃣ Impossible de retirer un reçu"
        ]
    },
    "2": {
        name: "Téléchargement de documents",
        suboptions: [
            "1️⃣ Fiche de paiement introuvable",
            "2️⃣ Problème d'impression",
            "3️⃣ Demande de duplicata",
            "4️⃣ Autre problème de téléchargement"
        ]
    },
    "3": {
        name: "Modifications",
        suboptions: [
            "1️⃣ Correction de date",
            "2️⃣ Modification du nom",
            "3️⃣ Changement d'adresse",
            "4️⃣ Autre demande de modification"
        ]
    },
    "4": {
        name: "Questions générales",
        suboptions: [
            "1️⃣ Comment légaliser un document ?",
            "2️⃣ Certificat médical",
            "3️⃣ Facture ministérielle"
        ],
        nestedSuboptions: {
            "2": [ // Sous-options pour "Certificat médical"
                "1️⃣ Coût d'un certificat médical",
                "2️⃣ Comment obtenir un certificat médical ?",
                "3️⃣ Retirer son certificat médical"
            ],
            "3": [ // Sous-options pour "Facture ministérielle"
                "1️⃣ Payer sa facture ministérielle"
            ]
        }
    },
    "5": {
        name: "Problèmes techniques",
        suboptions: [
            "1️⃣ Erreur de validation de paiement",
            "2️⃣ Numéro de dossier déjà utilisé",
            "3️⃣ Problème de connexion au site",
            "4️⃣ Autre problème technique"
        ]
    }
};

// Variables globales
let userStates = {};
const documentFolder = path.join(__dirname, 'documents');
const pendingRequests = new Map(); // Pour les notifications proactives

// Créer le dossier documents s'il n'existe pas
if (!fs.existsSync(documentFolder)) {
    fs.mkdirSync(documentFolder);
}

// Initialisation des fonctionnalités avancées
setupProactiveNotifications(client, pendingRequests);

// Gestionnaire d'événement : QR Code
client.on('qr', qr => {
    console.log("\n📷 Scannez ce QR code avec votre téléphone :");
    qrcode.generate(qr, { small: true });
});

// Gestionnaire d'événement : Bot prêt
client.on('ready', () => {
    console.log('✅ Bot WhatsApp connecté avec succès !');
});

// Gestionnaire d'événement : Message reçu
client.on('message', async msg => {
    try {
        const from = msg.from;
        let message = msg.body.trim();

        console.log(`📩 Message reçu de ${from}: ${message}`);

        // Traitement des messages vocaux
        if (msg.hasMedia) {
            const media = await msg.downloadMedia();
            if (media.mimetype.includes('audio')) {
                message = await processVoiceMessage(media);
                console.log(`Message vocal converti: ${message}`);
            }
        }

        // Détection de la langue et traduction si nécessaire
        const lang = await detectLanguage(message);
        if (lang !== 'fr') {
            message = await translateText(message, 'fr');
            console.log(`Message traduit en français: ${message}`);
        }

        // Compréhension des demandes écrites naturelles
        const matchedOption = await understandNaturalLanguage(message, options);
        if (matchedOption && !options[message]) {
            message = matchedOption;
            console.log(`Demande naturelle mappée à l'option: ${message}`);
        }

        // Gestion des états utilisateur
        if (userStates[from] === "awaiting_payment_confirmation") {
            if (message === "1") {
                userStates[from] = "awaiting_unique_code";
                await msg.reply("Veuillez entrer votre code unique :");
            } else if (message === "2") {
                delete userStates[from];
                await msg.reply("Pour générer votre document, vous devez d'abord effectuer le paiement. Une fois payé, vous recevrez un code unique par SMS, que vous pourrez utiliser pour récupérer votre document sur le site officiel. Si vous avez besoin d'aide, n'hésitez pas à nous contacter.");
            } else {
                await msg.reply("Veuillez répondre par '1' (Oui) ou '2' (Non). Avez-vous déjà effectué le paiement ?");
            }
            return;
        }

        if (userStates[from] === "awaiting_unique_code") {
            const filePath = path.join(documentFolder, `${message}.pdf`);
            console.log(`Chemin du fichier : ${filePath}`);

            try {
                if (fs.existsSync(filePath)) {
                    const media = MessageMedia.fromFilePath(filePath);
                    await msg.reply(media, null, { caption: "✅ Votre document a été trouvé. Voici votre fichier :" });
                } else {
                    await msg.reply("⚠️ Code unique invalide. Veuillez entrer un code correct.");
                }
            } catch (error) {
                console.error("Erreur lors de l'envoi du fichier :", error);
                await msg.reply("❌ Une erreur s'est produite lors de l'envoi du document. Veuillez réessayer plus tard.");
            }
            delete userStates[from];
            return;
        }

        if (userStates[from] === "awaiting_suboption") {
            if (message === "1") {
                userStates[from] = "awaiting_payment_confirmation";
                await msg.reply("Avez-vous déjà effectué le paiement ?\n1️⃣ Oui\n2️⃣ Non");
            } else {
                await sendMainMenu(msg);
                delete userStates[from];
            }
            return;
        }

        if (userStates[from] === "awaiting_general_questions") {
            if (message === "1") {
                await msg.reply("Pour légaliser un document, veuillez vous rendre au ministère compétent avec une copie du document et une pièce d'identité.");
            } else if (message === "2") {
                await sendNestedSubMenu(msg, "2");
                userStates[from] = "awaiting_certificat_medical";
            } else if (message === "3") {
                await sendNestedSubMenu(msg, "3");
                userStates[from] = "awaiting_facture_ministérielle";
            } else {
                await sendMainMenu(msg);
            }
            return;
        }

        if (userStates[from] === "awaiting_certificat_medical") {
            if (message === "1") {
                await msg.reply("Le coût d'un certificat médical est de 5 000 FCFA.");
            } else if (message === "2") {
                await msg.reply("Pour obtenir un certificat médical, veuillez vous rendre à l'hôpital le plus proche avec une pièce d'identité valide.");
            } else if (message === "3") {
                userStates[from] = "awaiting_payment_confirmation";
                await msg.reply("Avez-vous déjà effectué le paiement pour le certificat médical ?\n1️⃣ Oui\n2️⃣ Non");
            } else {
                await sendMainMenu(msg);
            }
            return;
        }

        if (userStates[from] === "awaiting_facture_ministérielle") {
            if (message === "1") {
                await msg.reply("Voici le lien pour payer votre facture ministérielle :\nhttps://www.elegantthemes.com/gallery/divi/");
                delete userStates[from];
            } else {
                await sendMainMenu(msg);
            }
            return;
        }

        if (userStates[from] === "awaiting_document_download") {
            if (message === "1") {
                await msg.reply("Pour télécharger votre fiche de paiement, veuillez suivre ce lien : [lien de téléchargement]");
            } else if (message === "2") {
                await msg.reply("Si vous rencontrez un problème d'impression, veuillez vérifier votre imprimante ou contacter le support technique.");
            } else if (message === "3") {
                await msg.reply("Pour demander un duplicata, veuillez remplir ce formulaire : [lien du formulaire]");
            } else if (message === "4") {
                await msg.reply("Pour toute autre demande, veuillez contacter un agent. Vous serez recontacté dans les 24 heures.");
                userStates[from] = "awaiting_agent_contact";
            } else {
                await sendMainMenu(msg);
            }
            return;
        }

        if (userStates[from] === "awaiting_modification") {
            if (message === "1") {
                await msg.reply("Pour corriger une date, veuillez fournir les documents justificatifs à l'adresse suivante : [adresse]");
            } else if (message === "2") {
                await msg.reply("Pour modifier un nom, veuillez fournir une preuve légale (acte de naissance, jugement, etc.) à l'adresse suivante : [adresse]");
            } else if (message === "3") {
                await msg.reply("Pour changer d'adresse, veuillez remplir ce formulaire : [lien du formulaire]");
            } else if (message === "4") {
                await msg.reply("Pour toute autre demande de modification, veuillez contacter un agent. Vous serez recontacté dans les 24 heures.");
                userStates[from] = "awaiting_agent_contact";
            } else {
                await sendMainMenu(msg);
            }
            return;
        }

        if (userStates[from] === "awaiting_technical_issue") {
            if (message === "1") {
                await msg.reply("Pour résoudre une erreur de validation de paiement, veuillez vérifier vos informations de paiement ou contacter votre banque.");
            } else if (message === "2") {
                await msg.reply("Si votre numéro de dossier est déjà utilisé, veuillez contacter le support technique pour vérification.");
            } else if (message === "3") {
                await msg.reply("Pour résoudre un problème de connexion au site, veuillez vérifier votre connexion internet ou contacter le support technique.");
            } else if (message === "4") {
                await msg.reply("Pour toute autre problème technique, veuillez contacter un agent. Vous serez recontacté dans les 24 heures.");
                userStates[from] = "awaiting_agent_contact";
            } else {
                await sendMainMenu(msg);
            }
            return;
        }

        if (userStates[from] === "awaiting_agent_contact") {
            await msg.reply("Un agent vous contactera dans les 24 heures. Merci de votre patience.");
            delete userStates[from];
            return;
        }

        // Gestion du menu principal
        if (!options[message]) {
            await sendMainMenu(msg);
        } else {
            if (message === "1") {
                await sendSubMenu(msg, "1");
                userStates[from] = "awaiting_suboption";
            } else if (message === "2") {
                await sendSubMenu(msg, "2");
                userStates[from] = "awaiting_document_download";
            } else if (message === "3") {
                await sendSubMenu(msg, "3");
                userStates[from] = "awaiting_modification";
            } else if (message === "4") {
                await sendSubMenu(msg, "4");
                userStates[from] = "awaiting_general_questions";
            } else if (message === "5") {
                await sendSubMenu(msg, "5");
                userStates[from] = "awaiting_technical_issue";
            } else {
                await sendMainMenu(msg);
            }
        }

        // Enregistrement des demandes nécessitant un suivi
        if (userStates[from] && userStates[from].includes("awaiting_agent_contact")) {
            pendingRequests.set(from, {
                request: message,
                timestamp: Date.now(),
                state: userStates[from]
            });
        }
    } catch (error) {
        console.error("Erreur dans le gestionnaire de message:", error);
    }
});

// Fonction pour envoyer le menu principal
async function sendMainMenu(msg) {
    let menuText = "Bienvenue ! Veuillez choisir une option en envoyant son numéro :\n\n";
    Object.keys(options).forEach(key => {
        menuText += `${key}️⃣ ${options[key].name}\n`;
    });
    await msg.reply(menuText);
}

// Fonction pour envoyer le sous-menu
async function sendSubMenu(msg, choice) {
    const submenuText = `${options[choice].name} :\n\n` + options[choice].suboptions.join('\n');
    await msg.reply(submenuText);
}

// Fonction pour envoyer les sous-options imbriquées
async function sendNestedSubMenu(msg, choice) {
    const submenuText = `${options["4"].suboptions[parseInt(choice) - 1]} :\n\n` + options["4"].nestedSuboptions[choice].join('\n');
    await msg.reply(submenuText);
}

// Démarrer le serveur Express
app.listen(port, () => {
    console.log(`🚀 Serveur WhatsApp opérationnel sur le port ${port}`);
});

// Initialiser le client WhatsApp
client.initialize();