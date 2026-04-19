require('dotenv').config();
const express = require('express');
const cors = require('cors');

const healthRouter = require('./routes/health');
const servicesRouter = require('./routes/services');
const costsRouter = require('./routes/costs');
const hiddenRouter = require('./routes/hidden');
const invoiceRouter = require('./routes/invoice');
const mapperRouter = require('./routes/mapper');
const hygieneRouter = require('./routes/hygiene');
const rightsizingRouter   = require('./routes/rightsizing');
const aggregateRouter     = require('./routes/aggregate');
const ec2Router           = require('./routes/ec2');
const rdsRouter           = require('./routes/rds');
const s3Router            = require('./routes/s3');
const organizationsRouter = require('./routes/organizations');
const othersRouter        = require('./routes/others');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'OPTIONS'],
}));
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/services', servicesRouter);
app.use('/api/costs', costsRouter);
app.use('/api/hidden', hiddenRouter);
app.use('/api/invoice', invoiceRouter);
app.use('/api/mapper', mapperRouter);
app.use('/api/hygiene', hygieneRouter);
app.use('/api/rightsizing',   rightsizingRouter);
app.use('/api/aggregate',    aggregateRouter);
app.use('/api/ec2',          ec2Router);
app.use('/api/rds',          rdsRouter);
app.use('/api/s3',           s3Router);
app.use('/api/organizations', organizationsRouter);
app.use('/api/others',       othersRouter);

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Cloudable API running on :${PORT}`));
}

module.exports = app;
