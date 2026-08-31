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

  // Сброс всех старых сессий (можно поднять через SESSION_EPOCH в .env)
  const sessionEpoch = Math.max(
    Number(process.env.SESSION_EPOCH || 1788202805),
    1788202805,
  );
  const current = await prisma.appSetting.findUnique({ where: { id: "default" } });
  if ((current?.sessionEpoch ?? 0) < sessionEpoch) {
    await prisma.appSetting.update({
      where: { id: "default" },
      data: { sessionEpoch },
    });
    console.log(`Session epoch set to ${sessionEpoch} (all older sessions revoked)`);
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

  await prisma.user.upsert({
    where: { login: adminLogin },
    update: {
      name: "Админ",
      password: await hashPassword(adminPassword),
      role: "admin",
    },
    create: {
      login: adminLogin,
      name: "Админ",
      password: await hashPassword(adminPassword),
      role: "admin",
    },
  });

  await prisma.user.upsert({
    where: { login: partnerLogin },
    update: {
      name: "Партнёр",
      password: await hashPassword(partnerPassword),
      role: "partner",
    },
    create: {
      login: partnerLogin,
      name: "Партнёр",
      password: await hashPassword(partnerPassword),
      role: "partner",
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
