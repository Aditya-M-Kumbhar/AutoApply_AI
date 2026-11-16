import mongoose from 'mongoose';

async function testLocalMongo() {
  try {
    console.log('Testing connection to mongodb://127.0.0.1:27017/test_local...');
    const conn = await mongoose.connect('mongodb://127.0.0.1:27017/test_local', {
      serverSelectionTimeoutMS: 3000
    });
    console.log('Success! Local MongoDB is running.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Failed to connect to local MongoDB:', err.message);
    process.exit(1);
  }
}

testLocalMongo();
