import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";

async function main() {
  const adminLogin = process.env.OWNER_LOGIN ?? "admin";
  const adminPassword = process.env.OWNER_PASSWORD ?? "shapecraft123";
  const partnerLogin = process.env.PARTNER_LOGIN ?? "partner";
  const partnerPassword = process.env.PARTNER_PASSWORD ?? "shapecraft123";

  await prisma.appSetting.upsert({
    where: { id: "default" },
    update: {},
    create: { ownerSplitPercent: 50, sessionEpoch: 0 },
  });

  // Сброс «залипшего» epoch после ошибочного деплоя безопасности
  const current = await prisma.appSetting.findUnique({ where: { id: "default" } });
  const badEpochFloor = 1788180000;
  if ((current?.sessionEpoch ?? 0) >= badEpochFloor) {
    await prisma.appSetting.update({
      where: { id: "default" },
      data: { sessionEpoch: 0 },
    });
    console.log("Session epoch reset (fixed bad security deploy value)");
  }

  await prisma.blockedIp.upsert({
    where: { ipAddress: "34.16.206.147" },
    update: {
      reason: "Google Cloud — попытки взлома shapecraft.ru",
    },
    create: {
      ipAddress: "34.16.206.147",
      reason: "Google Cloud — попытки взлома shapecraft.ru",
    },
  });

  await prisma.user.updateMany({
    where: { role: "owner" },
    data: { role: "admin" },
  });

  const resetPasswords = process.env.RESET_PASSWORDS === "1";

  await prisma.user.upsert({
    where: { login: adminLogin },
    update: resetPasswords
      ? {
          name: "Админ",
          password: await hashPassword(adminPassword),
          role: "admin",
        }
      : { name: "Админ", role: "admin" },
    create: {
      login: adminLogin,
      name: "Админ",
      password: await hashPassword(adminPassword),
      role: "admin",
    },
  });

  await prisma.user.upsert({
    where: { login: partnerLogin },
    update: resetPasswords
      ? {
          name: "Партнёр",
          password: await hashPassword(partnerPassword),
          role: "partner",
        }
      : { name: "Партнёр", role: "partner" },
    create: {
      login: partnerLogin,
      name: "Партнёр",
      password: await hashPassword(partnerPassword),
      role: "partner",
    },
  });

  const starterCategories = [
    { name: "Кликеры", slug: "klikery", sortOrder: 10 },
    { name: "Хэллоуин", slug: "hellouin", sortOrder: 20 },
    { name: "Антистресс", slug: "antistress", sortOrder: 30 },
    { name: "Коллекционные", slug: "kollektsionnye", sortOrder: 40 },
  ];

  for (const category of starterCategories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        sortOrder: category.sortOrder,
        active: true,
      },
      create: {
        name: category.name,
        slug: category.slug,
        sortOrder: category.sortOrder,
        active: true,
      },
    });
  }

  await prisma.storeBanner.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      title: "",
      text: "",
      imageUrl: null,
      active: false,
    },
  });

  console.log("Seed complete");
  console.log(`Admin: ${adminLogin} / ${adminPassword}`);
  console.log(`Partner: ${partnerLogin} / ${partnerPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
