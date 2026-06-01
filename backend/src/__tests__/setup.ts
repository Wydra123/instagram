import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDB, disconnectDB, getDb } from '../db/connection';

let mongod: MongoMemoryServer;

export async function setupDB(): Promise<void> {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri() + 'instagram';
  await connectDB();
}

export async function teardownDB(): Promise<void> {
  await disconnectDB();
  await mongod.stop();
}

export async function clearDB(): Promise<void> {
  const db = getDb();
  const collections = await db.listCollections().toArray();
  await Promise.all(collections.map((c) => db.collection(c.name).deleteMany({})));
}
