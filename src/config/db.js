import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import { PrismaPg } from "@prisma/adapter-pg";


const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'dev' ? ["query", "error", "warn"] : ["error"],
});

const connectDB = async () => {
    try {
        await prisma.$connect()
        console.log('DB connected via prisma')
    } catch (error) {
        console.error('DB connection via prisma failed: ', error)
        process.exit(1)
    }
};
const disconnectDB = async () => {
    await prisma.$disconnect();
}

export { prisma, connectDB, disconnectDB }
