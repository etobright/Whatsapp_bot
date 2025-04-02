import logging
import os
import requests  # Pour envoyer des requêtes HTTP
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, MessageHandler, filters, CallbackContext

# Configuration des logs
logging.basicConfig(format="%(asctime)s - %(levelname)s - %(message)s", level=logging.INFO)

# Clé API Telegram
TELEGRAM_TOKEN = "7922920905:AAGfYlyZQbDQiAbNGco4JSHj4qevLb1xNMQ"

# URL du backend Flask (remplacez par votre URL Ngrok)
BACKEND_URL = "https://e6e3-41-202-207-9.ngrok-free.app/log_journey"

# Variables globales pour gérer les états des utilisateurs
user_states = {}

# Chemin du dossier des documents
DOCUMENTS_FOLDER = "documents"

# Fonction pour envoyer les données au backend
async def log_journey(chat_id, platform, journey):
    data = {
        "chat_id": chat_id,
        "platform": platform,
        "journey": journey
    }
    try:
        response = requests.post(BACKEND_URL, json=data)
        if response.status_code == 200:
            logging.info("Parcours enregistré avec succès !")
        else:
            logging.error(f"Erreur lors de l'envoi des données au backend. Code de statut : {response.status_code}")
    except Exception as e:
        logging.error(f"Erreur lors de l'envoi des données au backend : {e}")

# Gestion des boutons du menu principal pour Telegram
async def start(update: Update, context: CallbackContext):
    keyboard = [
        [InlineKeyboardButton("💰 Problèmes de paiement", callback_data="1")],
        [InlineKeyboardButton("📁 Téléchargement de documents", callback_data="2")],
        [InlineKeyboardButton("✏️ Modifications", callback_data="3")],
        [InlineKeyboardButton("❓ Questions générales", callback_data="4")],
        [InlineKeyboardButton("🛠️ Problèmes techniques", callback_data="5")],
        [InlineKeyboardButton("0️⃣ Retour au menu principal", callback_data="0")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text("Bienvenue ! Veuillez choisir une option :", reply_markup=reply_markup)

# Gestion des sous-boutons dans Telegram
async def button_handler(update: Update, context: CallbackContext):
    query = update.callback_query
    await query.answer()

    options = {
        "1": {
            "name": "Problèmes de paiement",
            "suboptions": [
                "1️⃣ Reçu non généré",
                "2️⃣ Nom incorrect sur le reçu",
                "3️⃣ Impossible de retirer un reçu"
            ]
        },
        "2": {
            "name": "Téléchargement de documents",
            "suboptions": [
                "1️⃣ Fiche de paiement introuvable",
                "2️⃣ Problème d’impression",
                "3️⃣ Demande de duplicata",
                "4️⃣ Autre problème de téléchargement"
            ]
        },
        "3": {
            "name": "Modifications",
            "suboptions": [
                "1️⃣ Correction de date",
                "2️⃣ Modification du nom",
                "3️⃣ Changement d'adresse",
                "4️⃣ Autre demande de modification"
            ]
        },
        "4": {
            "name": "Questions générales",
            "suboptions": [
                "1️⃣ Comment légaliser un document ?",
                "2️⃣ Certificat médical",
                "3️⃣ Facture ministérielle"
            ],
            "nestedSuboptions": {
                "2": [
                    "1️⃣ Coût d’un certificat médical",
                    "2️⃣ Comment obtenir un certificat médical ?",
                    "3️⃣ Retirer son certificat médical"
                ],
                "3": [
                    "1️⃣ Payer sa facture ministérielle"
                ]
            }
        },
        "5": {
            "name": "Problèmes techniques",
            "suboptions": [
                "1️⃣ Erreur de validation de paiement",
                "2️⃣ Numéro de dossier déjà utilisé",
                "3️⃣ Problème de connexion au site",
                "4️⃣ Autre problème technique"
            ]
        }
    }

    if query.data == "0":
        await start(update, context)
        return

    if query.data in options:
        buttons = [[InlineKeyboardButton(opt, callback_data=f"{query.data}_{i+1}")] for i, opt in enumerate(options[query.data]["suboptions"])]
        buttons.append([InlineKeyboardButton("0️⃣ Retour au menu principal", callback_data="0")])
        reply_markup = InlineKeyboardMarkup(buttons)
        await query.message.reply_text(f"Vous avez choisi : {options[query.data]['name']}\nVeuillez sélectionner une sous-option :", reply_markup=reply_markup)
        await log_journey(query.from_user.id, "telegram", options[query.data]['name'])
    else:
        await handle_suboption(update, context, query.data)

# Gestion des sous-sous-boutons dans Telegram
async def handle_suboption(update: Update, context: CallbackContext, option_id: str):
    query = update.callback_query
    await query.answer()

    user_id = query.from_user.id
    user_states[user_id] = option_id  # Enregistrer l'état de l'utilisateur

    if option_id == "1_1":  # Reçu non généré
        await query.message.reply_text("Avez-vous déjà effectué le paiement ?\n1️⃣ Oui\n2️⃣ Non")
        await log_journey(user_id, "telegram", "Problèmes de paiement → Reçu non généré")
    elif option_id == "1_2":  # Nom incorrect sur le reçu
        await query.message.reply_text("Veuillez fournir votre numéro de dossier pour vérification.")
        await log_journey(user_id, "telegram", "Problèmes de paiement → Nom incorrect sur le reçu")
    elif option_id == "1_3":  # Impossible de retirer un reçu
        await query.message.reply_text("Avez-vous reçu un SMS avec un code unique après le paiement ?\n1️⃣ Oui\n2️⃣ Non")
        await log_journey(user_id, "telegram", "Problèmes de paiement → Impossible de retirer un reçu")
    elif option_id == "2_1":  # Fiche de paiement introuvable
        await query.message.reply_text("Avez-vous déjà effectué le paiement ?\n1️⃣ Oui\n2️⃣ Non")
        await log_journey(user_id, "telegram", "Téléchargement de documents → Fiche de paiement introuvable")
    elif option_id == "2_2":  # Problème d’impression
        await query.message.reply_text("Veuillez vérifier votre imprimante et réessayer. Si le problème persiste, contactez-nous.")
        await log_journey(user_id, "telegram", "Téléchargement de documents → Problème d’impression")
    elif option_id == "2_3":  # Demande de duplicata
        await query.message.reply_text("Veuillez fournir votre numéro de dossier pour générer un duplicata.")
        await log_journey(user_id, "telegram", "Téléchargement de documents → Demande de duplicata")
    elif option_id == "2_4":  # Autre problème de téléchargement
        await query.message.reply_text("Veuillez décrire brièvement le problème rencontré.")
        await log_journey(user_id, "telegram", "Téléchargement de documents → Autre problème de téléchargement")
    elif option_id == "3_1":  # Correction de date
        await query.message.reply_text("Veuillez fournir votre numéro de dossier et la date correcte.")
        await log_journey(user_id, "telegram", "Modifications → Correction de date")
    elif option_id == "3_2":  # Modification du nom
        await query.message.reply_text("Veuillez fournir votre numéro de dossier et le nom correct.")
        await log_journey(user_id, "telegram", "Modifications → Modification du nom")
    elif option_id == "3_3":  # Changement d'adresse
        await query.message.reply_text("Veuillez fournir votre numéro de dossier et la nouvelle adresse.")
        await log_journey(user_id, "telegram", "Modifications → Changement d'adresse")
    elif option_id == "3_4":  # Autre demande de modification
        await query.message.reply_text("Veuillez décrire brièvement la modification demandée.")
        await log_journey(user_id, "telegram", "Modifications → Autre demande de modification")
    elif option_id == "4_1":  # Comment légaliser un document ?
        await query.message.reply_text("Pour légaliser un document, veuillez vous rendre au ministère compétent avec une copie du document et une pièce d'identité.")
        await log_journey(user_id, "telegram", "Questions générales → Comment légaliser un document ?")
    elif option_id == "4_2_1":  # Coût d’un certificat médical
        await query.message.reply_text("Le coût d'un certificat médical est de 5 000 FCFA.")
        await log_journey(user_id, "telegram", "Questions générales → Certificat médical → Coût d’un certificat médical")
    elif option_id == "4_2_2":  # Comment obtenir un certificat médical ?
        await query.message.reply_text("Pour obtenir un certificat médical, veuillez vous rendre à l'hôpital le plus proche avec une pièce d'identité valide.")
        await log_journey(user_id, "telegram", "Questions générales → Certificat médical → Comment obtenir un certificat médical ?")
    elif option_id == "4_2_3":  # Retirer son certificat médical
        await query.message.reply_text("Avez-vous déjà effectué le paiement pour le certificat médical ?\n1️⃣ Oui\n2️⃣ Non")
        await log_journey(user_id, "telegram", "Questions générales → Certificat médical → Retirer son certificat médical")
    elif option_id == "4_3_1":  # Payer sa facture ministérielle
        await query.message.reply_text("Voici le lien pour payer votre facture ministérielle : [lien de paiement]")
        await log_journey(user_id, "telegram", "Questions générales → Facture ministérielle → Payer sa facture ministérielle")
    elif option_id == "5_1":  # Erreur de validation de paiement
        await query.message.reply_text("Veuillez vérifier vos informations de paiement ou contacter votre banque.")
        await log_journey(user_id, "telegram", "Problèmes techniques → Erreur de validation de paiement")
    elif option_id == "5_2":  # Numéro de dossier déjà utilisé
        await query.message.reply_text("Veuillez contacter le support technique pour vérification.")
        await log_journey(user_id, "telegram", "Problèmes techniques → Numéro de dossier déjà utilisé")
    elif option_id == "5_3":  # Problème de connexion au site
        await query.message.reply_text("Veuillez vérifier votre connexion internet ou réessayer plus tard.")
        await log_journey(user_id, "telegram", "Problèmes techniques → Problème de connexion au site")
    elif option_id == "5_4":  # Autre problème technique
        await query.message.reply_text("Veuillez décrire brièvement le problème technique rencontré.")
        await log_journey(user_id, "telegram", "Problèmes techniques → Autre problème technique")
    else:
        await query.message.reply_text("Option non reconnue. Veuillez réessayer.")

# Fonction principale de gestion des messages Telegram
async def handle_message(update: Update, context: CallbackContext):
    user_id = update.message.from_user.id
    user_message = update.message.text.lower()

    # Retour au menu principal si l'utilisateur envoie "0"
    if user_message == "0":
        await start(update, context)
        return

    if user_id in user_states:
        option_id = user_states[user_id]

        # Gestion des questions "Avez-vous déjà effectué le paiement ?"
        if option_id in ["1_1", "1_3", "2_1", "4_2_3"]:
            if user_message == "1":  # Oui
                await update.message.reply_text("Veuillez entrer votre code unique reçu par SMS :")
                user_states[user_id] = f"{option_id}_awaiting_code"  # Nouvel état : en attente du code unique
            elif user_message == "2":  # Non
                await update.message.reply_text("Veuillez effectuer le paiement et revenir une fois terminé.")
                del user_states[user_id]  # Réinitialiser l'état de l'utilisateur
            else:
                await update.message.reply_text("Veuillez répondre par '1' (Oui) ou '2' (Non).")
            return

        # Gestion du code unique
        if option_id.endswith("_awaiting_code"):
            if user_message.isdigit():
                code_unique = user_message
                file_path = os.path.join(DOCUMENTS_FOLDER, f"{code_unique}.pdf")
                if os.path.exists(file_path):
                    await update.message.reply_document(document=open(file_path, "rb"), caption="Voici votre document.")
                else:
                    await update.message.reply_text("⚠️ Code unique invalide. Veuillez vérifier et réessayer.")
            else:
                await update.message.reply_text("Veuillez entrer un code unique valide (chiffres uniquement).")
            del user_states[user_id]  # Réinitialiser l'état de l'utilisateur
            return

    await update.message.reply_text("Veuillez choisir une option dans le menu principal.")

# Fonction principale pour démarrer le bot
def main():
    app = Application.builder().token(TELEGRAM_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(button_handler))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    logging.info("Bot Telegram démarré avec succès.")
    app.run_polling()

if __name__ == "__main__":
    main()