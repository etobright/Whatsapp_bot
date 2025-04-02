// i18n.js - Version corrigée
const franc = require('franc-min');
const { translate } = require('free-translate');

async function detectLanguage(text) {
    try {
        // franc-min retourne directement le code langue
        return franc(text.substring(0, 100)); // On analyse les 100 premiers caractères pour plus d'efficacité
    } catch (error) {
        console.error("Erreur de détection de langue:", error);
        return 'fr'; // Par défaut on suppose que c'est du français
    }
}

async function translateText(text, targetLang) {
    try {
        if (targetLang !== 'fr') return text; // On ne traduit qu'en français
        
        const detected = await detectLanguage(text);
        if (detected === 'fr') return text;
        
        // Traduction seulement si ce n'est pas déjà en français
        const translated = await translate(text, { to: 'fr' });
        return translated;
    } catch (error) {
        console.error("Erreur de traduction:", error);
        return text; // En cas d'erreur, on retourne le texte original
    }
}

module.exports = { detectLanguage, translateText };