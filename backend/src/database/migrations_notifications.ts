import { execute } from "./connection";
export async function addNotificationsTable(): Promise<void> {
  try {
    await execute(`CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL, message TEXT NOT NULL, link TEXT,
      read BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW())`);
    console.log("[DB] notifications OK");
  } catch(e) { console.error("[DB] notifications error", (e as Error).message); }
}
