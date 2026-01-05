const {
  onDocumentCreated,
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

// Función para enviar notificación silenciosa al cliente al crear su cuenta
exports.silentClientCreateNotify = onDocumentCreated(
    "clients/{clientId}",
    async (event) => {
      // Obtiene el id y la información inicial del cliente
      const clientId = event.data.id;
      const newData = event.data.data();

      // Si no existe el id del cliente...
      if (!clientId) {
        return null; // Detiene la función aquí
      }

      // Obtiene el token del dispositivo
      const token = newData.fcm_token;

      // Si el token existe...
      if (token) {
        // Genera el mensaje para el dispositivo
        const message = {
          token: token,
          data: {
            action: "create_client_account",
            reason: clientId,
          },
          android: {
            priority: "high",
            collapseKey: "create_client_account",
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
      // Obtiene el id y la última información del cliente
      const clientId = event.data.id;
      const oldData = event.data.data();

      // Inicializa Firestore para hacer consultas
      const db = admin.firestore();

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

        try {
          // Busca todas las notificaciones que contengan este clientId
          const snapshot = await db.collection("notifications")
              .where("clients_id", "array-contains", clientId)
              .get();

          if (!snapshot.empty) {
            // Crea un array de promesas y las ejecuta en paralelo
            const updatePromises = snapshot.docs.map((doc) => {
              return doc.ref.update({
                // Elimina el elemento solo si existe
                clients_id: admin.firestore.FieldValue.arrayRemove(clientId),
              });
            });

            // Espera a que todas las actualizaciones terminen
            await Promise.all(updatePromises);
            console.log("Cliente eliminado de las notificaciones.");
          }
        } catch (error) {
          console.error(`Error eliminando cliente ${clientId}: `, error);
        }
      }

      return null;
    },
);

// Función para enviar notificación silenciosa
// al cliente al actualizar sus notificaciones
exports.silentNotificationUpdateNotify = onDocumentUpdated(
    "notifications/{notificationId}",
    async (event) => {
      // Obtiene datos previos y nuevos
      const newData = event.data.after.data();
      const oldData = event.data.before.data();

      // Si es una notificación inicial...
      if (newData.type === "initial") {
        return null; // Detiene la función aquí
      }

      // Asegura que los arrays de ids existan
      const previousClients = oldData.clients_id || [];
      const currentClients = newData.clients_id || [];

      // Variable para almacenar a quién se envía la notificación silenciosa
      let targetClientIds = [];

      // Si el contenido del mensaje cambió...
      if (newData.message !== oldData.message) {
        // Envía a todos los que están en la lista actualmente
        targetClientIds = currentClients;
      } else { // Si el mensaje es igual, verifica si se agregaron clientes...
        // Filtra solo los ids nuevos
        targetClientIds = currentClients.filter(
            (id) => !previousClients.includes(id),
        );
      }

      // Si no hay destinatarios (mismo mensaje y mismos clientes)...
      if (targetClientIds.length === 0) {
        return null; // Detiene la función aquí
      }

      // Inicializa Firestore para hacer consultas
      const db = admin.firestore();

      // Procesa el envío para la lista resultante (ya sea todos o solo nuevos)
      const promises = targetClientIds.map(async (clientId) => {
        try {
          // Consulta la colección 'clients' usando el id obtenido
          const cSnapshot = await db.collection("clients").doc(clientId).get();

          // Si no existe ningún cliente asociado al id...
          if (!cSnapshot.exists) {
            console.log(`El cliente con ID ${clientId} no existe en la BD.`);
            return null; // Detiene la función aquí
          }

          // Obtiene toda la información del cliente y recupera su token FCM
          const clientData = cSnapshot.data();
          const token = clientData.fcm_token;

          // Si el token existe...
          if (token) {
            // Genera el mensaje para el dispositivo
            const message = {
              token: token,
              data: {
                action: "refresh_user_notifications",
                reason: "updated_notifications",
              },
              android: {
                priority: "high",
                collapseKey: "refresh_user_notifications",
              },
            };

            // Envía el mensaje
            await admin.messaging().send(message);
            console.log("Notificación enviada al cliente: ", clientId);
          }
        } catch (error) {
          console.error(`Error procesando cliente ${clientId}:`, error);
        }
      });

      // Espera a que todas las notificaciones se envíen
      await Promise.all(promises);

      return null;
    },
);
