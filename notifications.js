function setupProactiveNotifications(client, pendingRequests) {
    setInterval(() => {
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;

        pendingRequests.forEach((request, user) => {
            if (now - request.timestamp > twentyFourHours) {
                client.sendMessage(user, 
                    "🔔 Rappel : Votre demande n'a pas encore été traitée. " +
                    "Un agent vous contactera bientôt. Merci de votre patience.");
                pendingRequests.delete(user);
            }
        });
    }, 60 * 60 * 1000); // Vérifie toutes les heures
}

module.exports = { setupProactiveNotifications };