import express from 'express'
import cors from 'cors';
import cookieParser from 'cookie-parser';
import adminRoutes from './routes/adminRoutes.js'
import authRoutes from './routes/authRoutes.js'
import userRoute from './routes/userRoutes.js'
import { connectDB, disconnectDB } from './config/db.js';
import { authMiddleware } from './middleware/authMiddleware.js';

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


app.use('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    })
})
app.use('/auth', authRoutes)
app.use('/user', userRoute)
// app.use()
app.use('/admin', authMiddleware, adminRoutes)
app.use((req, res) => {
    res.status(404).json({
        error: `Route ${req.originalUrl} not found`,
        code: 'NOT_FOUND'
    });
});


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