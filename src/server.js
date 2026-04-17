import express from 'express'
import cors from 'cors';
import cookieParser from 'cookie-parser';
import adminRoutes from './routes/adminRoutes.js'
import authRoutes from './routes/authRoutes.js'
import { connectDB, disconnectDB } from './config/db.js';

connectDB();

const port = process.env.PORT || 5001
const app = express()

app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }))


app.use('/', adminRoutes)
app.use('/auth', authRoutes)


const server = app.listen(port, () => console.log(`listening to port ${port}`))


process.on('unhandledRejection', (err) => {
    console.error(`Unhandled Rejection  : ${err.message}`);
    server.close(async () => {
        await disconnectDB();
        process.exit(1);
    })
});
process.on('uncaughtException', async (err) => {
    console.error(`Uncaught Exception: ${err.message}`);
    await disconnectDB();
    process.exit(1);
});
process.on('SIGINT', async (err) => {
    console.error(`SIGTERM received, shutting down: ${err.message}`);
    server.close(async () => {
        await disconnectDB();
        process.exit(0);
    })
});