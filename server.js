const express = require('express');
const api = require('./api/api');

const app = express();

app.use('/api', api);

app.listen(80, () => {
  console.log('server listening at port 80');
});
