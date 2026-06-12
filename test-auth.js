const admin = require("firebase-admin");
const app = admin.initializeApp({ projectId: "steam-port-ff4nj" });
const auth = admin.auth(app);
auth.verifyIdToken("fake-token").catch(e => console.log("Expected auth err:", e.message));
