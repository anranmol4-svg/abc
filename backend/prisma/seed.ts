import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  // Editors
  const editor1 = await prisma.user.upsert({
    where: { email: 'editor1@example.com' },
    update: {},
    create: {
      email: 'editor1@example.com',
      password: passwordHash,
      role: Role.EDITOR,
    },
  });

  const editor2 = await prisma.user.upsert({
    where: { email: 'editor2@example.com' },
    update: {},
    create: {
      email: 'editor2@example.com',
      password: passwordHash,
      role: Role.EDITOR,
    },
  });

  // Writers
  const writer1 = await prisma.user.upsert({
    where: { email: 'writer1@example.com' },
    update: {},
    create: {
      email: 'writer1@example.com',
      password: passwordHash,
      role: Role.WRITER,
    },
  });
  
  const writer2 = await prisma.user.upsert({
    where: { email: 'writer2@example.com' },
    update: {},
    create: {
      email: 'writer2@example.com',
      password: passwordHash,
      role: Role.WRITER,
    },
  });

  console.log({ editor1, editor2, writer1, writer2 });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
