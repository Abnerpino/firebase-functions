const {
  onDocumentUpdated,
  onDocumentDeleted,
} = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const {setGlobalOptions} = require("firebase-functions/v2");

admin.initializeApp();

// Configuración global
setGlobalOptions({
  region: "us-central1",
});

// Función para enviar notificación silenciosa al cliente al actualizar su info
exports.silentClientUpdateNotify = onDocumentUpdated(
    "clients/{clientId}",
    async (event) => {
      const newData = event.data.after.data();

      // Si la bandera no está activada...
      if (newData.force_update !== true) {
        return null; // Detiene la función aquí
      }

      // Obtiene el token del dispositivo
      const token = newData.fcm_token;
      // Asigna la razón de la actualización
      const reason = newData.active ? "updated_information" : "account_expired";

      // Si el token existe...
      if (token) {
        // Genera el mensaje para el dispositivo
        const message = {
          token: token,
          data: {
            action: "refresh_user_data",
            reason: reason,
          },
          android: {
            priority: "high",
            collapseKey: "refresh_user_data",
          },
        };

        try {
          // Envía el mensaje a través de la notificación silenciosa
          await admin.messaging().send(message);
          console.log("Notificación silenciosa enviada a: ", token);
        } catch (error) {
          console.error("Error enviando FCM a : " + token + ". " + error);
        }
      }

      try {
        // Desactiva la bandera para evitar bucle
        await event.data.after.ref.update({
          force_update: false,
        });
      } catch (error) {
        console.error("Error al resetear la bandera: ", error);
      }

      return null;
    },
);

// Función para enviar notificación silenciosa al cliente al eliminar su info
exports.silentClientDeleteNotify = onDocumentDeleted(
    "clients/{clientId}",
    async (event) => {
      const oldData = event.data.data();
      // Obtiene el token del dispositivo
      const token = oldData.fcm_token;

      // Si el token existe...
      if (token) {
        // Genera el mensaje para el dispositivo
        const message = {
          token: token,
          data: {
            action: "erase_user_data",
            reason: "account_deleted",
          },
          android: {
            priority: "high",
            collapseKey: "erase_user_data",
          },
        };

        try {
          // Envía el mensaje a través de la notificación silenciosa
          await admin.messaging().send(message);
          console.log("Notificación silenciosa enviada a: ", token);
        } catch (error) {
          console.error("Error enviando FCM a : " + token + ". " + error);
        }
      }

      return null;
    },
);
