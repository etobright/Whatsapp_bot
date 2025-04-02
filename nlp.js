const natural = require('natural');
const tokenizer = new natural.WordTokenizer();

function understandNaturalLanguage(message, options) {
    // Normaliser le message
    const normalized = message.toLowerCase().trim();
    
    // Recherche directe dans les options
    for (const [key, option] of Object.entries(options)) {
        // Vérifier le nom principal
        if (option.name.toLowerCase().includes(normalized)) {
            return key;
        }
        
        // Vérifier les sous-options
        for (const suboption of option.suboptions) {
            if (suboption.toLowerCase().includes(normalized)) {
                return key;
            }
        }
    }
    
    // Recherche par mots-clés
    const tokens = tokenizer.tokenize(normalized);
    
    const keywordMap = {
        'paiement': '1',
        'pay': '1',
        'reçu': '1',
        'document': '2',
        'télécharger': '2',
        'fiche': '2',
        'modifier': '3',
        'changer': '3',
        'corriger': '3',
        'question': '4',
        'certificat': '4',
        'facture': '4',
        'technique': '5',
        'erreur': '5',
        'connexion': '5'
    };
    
    for (const token of tokens) {
        if (keywordMap[token]) {
            return keywordMap[token];
        }
    }
    
    return null;
}

module.exports = { understandNaturalLanguage };