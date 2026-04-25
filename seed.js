// seed.js
import 'dotenv/config'
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SESSION_ID = 'cmoe2qbzl0000nkvak7yybbic'

async function main() {
    const records = Array.from({ length: 50 }, (_, i) => ({
        sessionId: SESSION_ID,
        name: `Corper ${i + 1}`,
        stateCode: `NY/${String(i + 1).padStart(4, '0')}`,
        queueNumber: i + 1,
        addedByAdmin: true,
        timestamp: new Date()
    }))

    await prisma.attendanceRecord.createMany({ data: records })
    console.log('Seeded 50 records')
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())