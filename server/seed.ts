import { db } from "./db";
import { companies, users } from "@shared/schema";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";

export async function seedDatabase() {
  const existingCompanies = await db.select().from(companies);
  if (existingCompanies.length > 0) {
    if (process.env.REPAIR_PASSWORDS === "true") {
      await repairPasswords();
    }
    return;
  }

  console.log("Criando empresa master e usuário administrador...");

  const [masterCompany] = await db.insert(companies).values([
    {
      name: "Admin VOIP",
      domain: "admin-voip.com.br",
      type: "master",
      maxExtensions: 500,
      maxTrunks: 50,
      contactName: "Administrador",
      contactEmail: "admin@admin-voip.com.br",
      contactPhone: "",
      active: true,
    },
  ]).returning();

  await db.insert(users).values([
    {
      username: "admin",
      password: bcrypt.hashSync("admin123", 10),
      fullName: "Administrador",
      email: "admin@admin-voip.com.br",
      role: "super_admin" as const,
      companyId: masterCompany.id,
      active: true,
    },
  ]);

  console.log("Empresa master e administrador criados com sucesso!");
  console.log("Login: admin / admin123");
}

async function repairPasswords() {
  const targetUsers = ["wesleycm2@gmail.com", "yurialexsandersd@gmail.com"];
  const defaultPassword = "admin123";

  for (const username of targetUsers) {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    if (!user) continue;

    const isValid = await bcrypt.compare(defaultPassword, user.password);
    if (!isValid) {
      const newHash = await bcrypt.hash(defaultPassword, 10);
      await db.update(users).set({ password: newHash }).where(eq(users.id, user.id));
      console.log(`[REPAIR] Senha do usuário ${username} foi reparada.`);
    }
  }
  console.log("[REPAIR] Reparo de senhas concluído. Remova REPAIR_PASSWORDS do ambiente.");
}
