import * as winston from 'winston';

export const LOGGER = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({
            dirname: 'log',
            filename: 'server.log',
            level: 'info',
            maxFiles: 10,
            maxsize: 1024*1024,
        }),
    ]
});
