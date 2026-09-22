import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const uri = process.env.MONGODB_URI;

console.log('\n======================================================');
console.log('       MongoDB Connection Diagnostic & Check');
console.log('======================================================\n');

if (!uri) {
  console.log('⚠️  No MONGODB_URI detected in your environment or .env file.');
  console.log('\nTo connect to MongoDB:');
  console.log('1. Copy .env.example to .env:');
  console.log('   cp .env.example .env');
  console.log('2. Set your connection string in .env:');
  console.log('   MONGODB_URI=mongodb://localhost:27017/interview-prep-kit');
  console.log('   OR MongoDB Atlas (Free Cloud):');
  console.log('   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/interview-prep-kit?retryWrites=true&w=majority\n');
  process.exit(0);
}

console.log(`Connecting to: ${uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')} ...`);

const startTime = Date.now();

mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })
  .then(async () => {
    const elapsed = Date.now() - startTime;
    console.log(`\n✅ Successfully connected to MongoDB! (${elapsed}ms)`);
    console.log(`   Database Name: ${mongoose.connection.name}`);
    console.log(`   Host:          ${mongoose.connection.host}`);
    console.log(`   Port:          ${mongoose.connection.port}`);

    // List collections
    const collections = await mongoose.connection.db?.listCollections().toArray();
    console.log('\nExisting Collections:');
    if (!collections || collections.length === 0) {
      console.log('   (Database is currently empty; collections will be initialized on first write)');
    } else {
      for (const col of collections) {
        const count = await mongoose.connection.db?.collection(col.name).countDocuments();
        console.log(`   - ${col.name}: ${count} document(s)`);
      }
    }

    console.log('\n🎉 MongoDB is fully configured and ready for production usage!\n');
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch((err) => {
    console.error(`\n❌ Failed to connect to MongoDB: ${err.message}`);
    console.log('\nTroubleshooting suggestions:');
    console.log('1. If running locally, ensure MongoDB service or daemon is running:');
    console.log('   mongod --dbpath <data_directory>');
    console.log('   OR with Docker:');
    console.log('   docker run -d -p 27017:27017 --name mongo-dev mongo:latest');
    console.log('2. If using MongoDB Atlas:');
    console.log('   - Ensure your IP address is whitelisted in Network Access (0.0.0.0/0 for testing)');
    console.log('   - Check your database username and password in MONGODB_URI in .env');
    console.log('3. Remember the app has an automatic fallback store, so it continues to function even if MongoDB is temporarily unavailable.\n');
    process.exit(1);
  });
