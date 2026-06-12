import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

let app;
if (!getApps().length) {
  try {
    app = initializeApp({
        projectId: "steam-port-ff4nj",
    });
  } catch (error) {
    console.error("Firebase admin init error:", error);
  }
} else {
  app = getApp();
}

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app, "ai-studio-070dfb43-05fd-44e4-a0f4-f00ac0df6737");

