-- Rename email column to login
ALTER TABLE "User" RENAME COLUMN "email" TO "login";

-- Migrate old email-style logins
UPDATE "User" SET login = 'admin' WHERE login = 'owner@shapecraft.ru';
UPDATE "User" SET login = 'partner' WHERE login = 'partner@shapecraft.ru';
