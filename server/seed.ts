import { db } from "./db";
import { companies, users } from "@shared/schema";
import bcrypt from "bcrypt";

export async function seedDatabase() {
  const existingCompanies = await db.select().from(companies);
  if (existingCompanies.length > 0) return;

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
