import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const app = initializeApp({ projectId: "steam-port-ff4nj" });
const db = getFirestore(app, "ai-studio-070dfb43-05fd-44e4-a0f4-f00ac0df6737");
db.collection("purchases").limit(1).get().then(() => console.log("SUCCESS")).catch(e => console.error("ERROR:", e));
