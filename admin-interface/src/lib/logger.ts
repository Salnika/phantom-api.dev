import pino from 'pino';

const baseLogger = pino({
    level: 'info',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
        },
    },
});

const logger = {
    info: baseLogger.info.bind(baseLogger),
    warn: baseLogger.warn.bind(baseLogger),
    error: baseLogger.error.bind(baseLogger),
    success: (msg: string, ...args: any[]) => baseLogger.info({ success: true }, msg, ...args),
};

export default logger;
