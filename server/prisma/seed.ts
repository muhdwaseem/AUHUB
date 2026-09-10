import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/index.js";
import { makePassword, makeStrongPassword, makeUsername } from "../src/lib/credentials.js";

const prisma = new PrismaClient();

const ADMIN_USERNAME = process.env.SEED_ADMIN_USERNAME || "admin";

const DEFAULT_CATEGORIES = ["Flight", "Total Travel", "Visa", "Hotel Bookings"];

const CURRENCIES = [
  { code: "AED", symbol: "AED", decimals: 2, isBase: true },
  { code: "USD", symbol: "$", decimals: 2, isBase: false },
  { code: "THB", symbol: "฿", decimals: 2, isBase: false },
  { code: "IDR", symbol: "Rp", decimals: 0, isBase: false },
];

async function main() {
  // --- Admin ---
  // Never resets an existing admin's password (re-running the seed is safe).
  // On first creation, use SEED_ADMIN_PASSWORD if given, otherwise a random one
  // printed once here — so a fresh deploy is never left on a known credential.
  const existingAdmin = await prisma.user.findUnique({ where: { username: ADMIN_USERNAME } });
  if (existingAdmin) {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: { role: "ADMIN", status: "ACTIVE" },
    });
    console.log(`Admin "${ADMIN_USERNAME}" already exists — password left unchanged`);
  } else {
    const chosen = process.env.SEED_ADMIN_PASSWORD;
    const adminPassword = chosen || makeStrongPassword();
    await prisma.user.create({
      data: {
        username: ADMIN_USERNAME,
        password: await bcrypt.hash(adminPassword, 10),
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
    const bar = "=".repeat(64);
    console.log(bar);
    console.log("  ADMIN ACCOUNT CREATED");
    console.log(`  username: ${ADMIN_USERNAME}`);
    console.log(`  password: ${adminPassword}`);
    if (!chosen)
      console.log("  (random — set SEED_ADMIN_PASSWORD to pick your own. Not shown again.)");
    console.log(bar);
  }

  // --- Expense headers ---
  for (const name of DEFAULT_CATEGORIES) {
    await prisma.expenseCategory.upsert({
      where: { name },
      update: { isDefault: true },
      create: { name, isDefault: true },
    });
  }
  console.log(`Seeded ${DEFAULT_CATEGORIES.length} default expense headers`);

  // --- Currencies ---
  for (const c of CURRENCIES) {
    await prisma.currency.upsert({
      where: { code: c.code },
      update: { symbol: c.symbol, decimals: c.decimals }, // never flip isBase on an existing row
      create: c,
    });
  }
  console.log(`Seeded ${CURRENCIES.length} currencies (base: AED)`);

  // --- Demo data (only if the book is empty) ---
  const investorCount = await prisma.investor.count();
  if (investorCount === 0) {
    const demoInvestors = [
      { name: "Ravi Menon", email: "ravi@example.com", phone: "+971 50 111 2222", sharePercentage: 60, capitalInvested: 600000 },
      { name: "Priya Nair", email: "priya@example.com", phone: "+971 50 333 4444", sharePercentage: 40, capitalInvested: 400000 },
    ];
    for (const di of demoInvestors) {
      const username = makeUsername(di.name);
      const password = makePassword();
      const hash = await bcrypt.hash(password, 10);
      await prisma.investor.create({
        data: {
          ...di,
          generatedUsername: username,
          generatedPassword: password,
          user: { create: { username, password: hash, role: "INVESTOR", status: "ACTIVE" } },
        },
      });
      console.log(`Demo investor "${di.name}"  ->  username: ${username}  password: ${password}`);
    }

    const flight = await prisma.expenseCategory.findUnique({ where: { name: "Flight" } });
    const hotel = await prisma.expenseCategory.findUnique({ where: { name: "Hotel Bookings" } });
    const visa = await prisma.expenseCategory.findUnique({ where: { name: "Visa" } });

    const d = (s: string) => new Date(s + "T10:00:00.000Z");

    await prisma.goldTransaction.createMany({
      data: [
        { type: "BUY", date: d("2026-08-25"), quality: "24K", quantityGrams: 500, ratePerGram: 235, totalAmount: 117500, counterparty: "Dubai Gold Souk - Al Fardan" },
        { type: "BUY", date: d("2026-08-27"), quality: "22K", quantityGrams: 300, ratePerGram: 215, totalAmount: 64500, counterparty: "Sharjah Bullion" },
        { type: "SELL", date: d("2026-08-28"), quality: "24K", quantityGrams: 200, ratePerGram: 252, totalAmount: 50400, counterparty: "Retail - Kochi" },
        { type: "SELL", date: d("2026-08-30"), quality: "22K", quantityGrams: 150, ratePerGram: 228, totalAmount: 34200, counterparty: "Retail - Kochi" },
        { type: "BUY", date: d("2026-09-01"), quality: "24K", quantityGrams: 400, ratePerGram: 240, totalAmount: 96000, counterparty: "Dubai Gold Souk - Al Fardan" },
        { type: "SELL", date: d("2026-09-02"), quality: "24K", quantityGrams: 300, ratePerGram: 258, totalAmount: 77400, counterparty: "Wholesale - Mumbai" },
      ],
    });

    const ravi = await prisma.investor.findFirst({ where: { name: "Ravi Menon" } });
    const priya = await prisma.investor.findFirst({ where: { name: "Priya Nair" } });

    await prisma.expense.createMany({
      data: [
        { categoryId: flight!.id, amount: 1850, date: d("2026-08-24"), description: "DXB -> COK return, buying trip" },
        { categoryId: hotel!.id, amount: 920, date: d("2026-08-25"), description: "3 nights, Deira" },
        { categoryId: visa!.id, amount: 350, date: d("2026-08-24"), description: "Visit visa renewal" },
        // tagged to Ravi but still shared across everyone
        { categoryId: flight!.id, amount: 1600, date: d("2026-09-01"), description: "DXB -> BOM, wholesale deal", investorId: ravi?.id ?? null },
        // charged to Priya only (her personal trip) -> comes off her share alone
        { categoryId: visa!.id, amount: 300, date: d("2026-09-01"), description: "Priya's personal visa run", investorId: priya?.id ?? null, chargedToInvestor: !!priya },
      ],
    });
    console.log("Seeded sample gold transactions and expenses (incl. 1 tagged + 1 charged)");
  } else {
    console.log("Investors already exist — skipping demo data");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
