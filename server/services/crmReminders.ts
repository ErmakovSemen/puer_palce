import { db } from "../db";
import { crmTasks, crmContacts, crmAdmins } from "@shared/schema";
import { sendTelegramMessage } from "../telegram";
import { eq } from "drizzle-orm";

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function dispatchCrmReminders() {
  const [tasks, contacts, admins] = await Promise.all([
    db.select().from(crmTasks),
    db.select().from(crmContacts),
    db.select().from(crmAdmins),
  ]);
  const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
  const adminById = new Map(admins.map((admin) => [admin.id, admin]));
  const now = Date.now();

  for (const task of tasks) {
    if (task.status !== "open" || task.reminderSentAt || !task.dueAt || new Date(task.dueAt).getTime() > now) continue;
    if (!task.contactId) continue;
    const contact = contactById.get(task.contactId);
    if (!contact) continue;
    const owner = contact.ownerId ? adminById.get(contact.ownerId) : undefined;
    const action = task.kind === "call" ? "Позвонить" : task.kind === "message" ? "Написать" : "Связаться";
    const text = `<b>Напоминание CRM</b>\n${action}: <b>${escapeHtml(contact.name)}</b>${contact.phone ? `\nТелефон: ${escapeHtml(contact.phone)}` : ""}${contact.telegram ? `\nTelegram: ${escapeHtml(contact.telegram)}` : ""}${owner ? `\nОтветственный: ${escapeHtml(owner.name)}` : ""}\n\n${escapeHtml(task.title)}`;
    if (await sendTelegramMessage(text)) {
      await db.update(crmTasks).set({ reminderSentAt: new Date().toISOString() }).where(eq(crmTasks.id, task.id));
    }
  }
}

export function startCrmReminderScheduler() {
  void dispatchCrmReminders().catch((error) => console.error("CRM reminder initial run failed:", error));
  setInterval(() => void dispatchCrmReminders().catch((error) => console.error("CRM reminder run failed:", error)), 3 * 60 * 60 * 1000);
}
