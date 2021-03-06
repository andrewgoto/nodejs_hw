const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const expressDomain = require('express-domain-middleware');
const router = require('./router');

const accessLogStream = fs.createWriteStream(
  path.join(__dirname, 'access.log'),
  { flags: 'a' },
);

class CrudServer {
  constructor() {
    this.app = null;
  }

  async setup() {
    this.initServer();
    await this.initDatabase();
    this.initMiddlewares();
    this.initRouters();
    this.initErrorHandling();
    return this;
  }

  initServer() {
    this.app = express();
  }

  async initDatabase() {
    try {
      mongoose.set('useCreateIndex', true);
      await mongoose.connect(process.env.MONGODB_URL, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useFindAndModify: false,
      });
    } catch (err) {
      console.log(err);
      process.exit(1);
    }
  }

  initMiddlewares() {
    this.app.use(expressDomain);
    this.app.use(morgan('combined', { stream: accessLogStream }));
    this.app.use(cors({ origin: process.env.ORIGIN }));
    this.app.use(express.urlencoded({ extended: false }));
    this.app.use(express.json());
    this.app.use(express.static('public'));
  }

  initRouters() {
    this.app.use('/api/v1', router);
    this.app.use((req, res) =>
      res.status(404).json({
        message: 'Not found',
        description: 'The resource you tried to access does not exist.',
      }),
    );
  }

  initErrorHandling() {
    this.app.use((err, req, res, next) => {
      if (err.name === 'ValidationError') {
        if (err.details) {
          err.message = `Validation error: ${err.details
            .map(item => item.message)
            .join(', ')}`;
        }
        const statusName = 'fail';
        return res
          .status(400)
          .json({ status: statusName, message: err.message });
      }
      return next(err);
    });

    this.app.use((err, req, res, next) => {
      const status = err.status || 500;
      const statusName = err.statusName || 'error';
      return res
        .status(status)
        .json({ status: statusName, message: err.message });
    });
  }

  startListening() {
    return this.app.listen(process.env.PORT, () => {
      console.log('Server started listening on port', process.env.PORT);
    });
  }
}

module.exports = CrudServer;
