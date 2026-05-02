import { createClient } from "redis";

const redis = createClient({
    socket: {
        host: '127.0.0.1',
        port: 6379,
    }
});

redis.on('error', (err) => console.error('Redis error: ', err));
await redis.connect();
console.log('Redis connected:', redis.isReady);
export default redis;