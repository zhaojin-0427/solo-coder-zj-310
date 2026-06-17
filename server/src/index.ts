import express from 'express';
import cors from 'cors';
import dollRoutes from './routes/dolls';
import orderRoutes from './routes/orders';
import patternRoutes from './routes/patterns';
import fittingRoutes from './routes/fittings';
import statsRoutes from './routes/stats';

const app = express();
const PORT = 9722;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'BJD娃衣定制系统后端服务运行正常' });
});

app.use('/api/dolls', dollRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/patterns', patternRoutes);
app.use('/api/fittings', fittingRoutes);
app.use('/api/stats', statsRoutes);

app.listen(PORT, () => {
  console.log(`🚀 BJD娃衣定制系统后端服务已启动: http://localhost:${PORT}`);
});

export default app;
