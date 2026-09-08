const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/portfolio')
  .then(() => Admin.find().then(a => {
    console.log('Admin records:', JSON.stringify(a, null, 2));
    process.exit(0);
  }))
  .catch(e => { console.error(e.message); process.exit(1); });