import { startServer } from './api/server';

// 从环境变量获取端口，默认为3000
const port = Number(process.env.PORT) || 3000;

// 启动服务器
startServer(port);
