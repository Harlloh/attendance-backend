import http from 'k6/http';
import { check } from 'k6';

export const options = {
    stages: [
        { duration: '10s', target: 50 },
        { duration: '10s', target: 50 },
        { duration: '20s', target: 200 },
        { duration: '20s', target: 200 },
        { duration: '20s', target: 600 },
        { duration: '20s', target: 100 },
        { duration: '10s', target: 0 },
    ],
};

export default function () {
    const url = 'http://localhost:8000/user/validateSession?checkInSlug=hft-gbew-cpm';
    // const url = 'https://attendance-backend-qnf8.onrender.com/user/validateSession?checkInSlug=hft-gbew-cpm';

    // const payload = JSON.stringify({
    //     stateCode: `SC-${__VU}-${__ITER}`,
    //     name: `User-${__VU}-${__ITER}`,
    //     browserId: `device-${__VU}-${__ITER}`,
    //     checkInSlug: 'hft-gbew-cpm',
    // });

    const params = {
        headers: {
            'Content-Type': 'application/json',
        },
    };

    const res = http.get(url, params);
    // const res = http.post(url, payload, params);

    check(res, {
        'status is expected': (r) => [200, 201, 400].includes(r.status),
    });
}