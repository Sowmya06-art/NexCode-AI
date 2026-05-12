// db.js

const mongoose = require('mongoose');
// We don't need to require('dotenv') here if you've already required it in server.js,
// but adding it ensures the MONGO_URI is found.

const connectDB = async () => {
  try {
    // We use process.env.MONGO_URI to hide your password from the code
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/collabcode');
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`Database Connection Error: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;