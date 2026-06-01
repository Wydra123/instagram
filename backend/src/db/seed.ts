import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { connectDB, disconnectDB, getDb } from './connection';

dotenv.config();

const SAMPLE_USERS = [
  { username: 'alice', email: 'alice@example.com', password: 'password123', bio: 'Photography lover 📸', profilePicture: 'https://i.pravatar.cc/150?u=alice' },
  { username: 'bob', email: 'bob@example.com', password: 'password123', bio: 'Travel & food enthusiast 🌍', profilePicture: 'https://i.pravatar.cc/150?u=bob' },
  { username: 'carol', email: 'carol@example.com', password: 'password123', bio: 'Just living life ✨', profilePicture: 'https://i.pravatar.cc/150?u=carol' },
  { username: 'dave', email: 'dave@example.com', password: 'password123', bio: 'Coffee addict ☕', profilePicture: 'https://i.pravatar.cc/150?u=dave' },
  { username: 'eve', email: 'eve@example.com', password: 'password123', bio: 'Art & design 🎨', profilePicture: 'https://i.pravatar.cc/150?u=eve' },
];

async function seed() {
  await connectDB();
  const db = getDb();

  await db.collection('users').deleteMany({});
  await db.collection('posts').deleteMany({});
  console.log('Cleared existing users and posts');

  const now = new Date();
  const userDocs = await Promise.all(
    SAMPLE_USERS.map(async (u) => ({
      _id: new ObjectId(),
      username: u.username,
      email: u.email,
      passwordHash: await bcrypt.hash(u.password, 10),
      bio: u.bio,
      profilePicture: u.profilePicture,
      followers: [] as ObjectId[],
      following: [] as ObjectId[],
      createdAt: now,
      updatedAt: now,
    })),
  );

  await db.collection('users').insertMany(userDocs);
  console.log(`Created ${userDocs.length} users`);

  const [alice, bob, carol, dave, eve] = userDocs;

  await Promise.all([
    db.collection('users').updateOne({ _id: alice._id }, { $set: { following: [bob._id, carol._id], followers: [bob._id, eve._id] } }),
    db.collection('users').updateOne({ _id: bob._id }, { $set: { following: [alice._id, dave._id], followers: [alice._id, carol._id] } }),
    db.collection('users').updateOne({ _id: carol._id }, { $set: { following: [bob._id, eve._id], followers: [alice._id, dave._id] } }),
    db.collection('users').updateOne({ _id: dave._id }, { $set: { following: [carol._id, alice._id], followers: [bob._id, eve._id] } }),
    db.collection('users').updateOne({ _id: eve._id }, { $set: { following: [alice._id, dave._id], followers: [carol._id, dave._id] } }),
  ]);
  console.log('Set up follow relationships');

  await db.collection('posts').insertMany([
    {
      _id: new ObjectId(), author: alice._id,
      imageUrl: 'https://picsum.photos/seed/alice1/600/600', images: [], caption: 'Beautiful morning! 🌅',
      likes: [bob._id, carol._id, dave._id],
      comments: [
        { _id: new ObjectId(), user: bob._id, text: 'Stunning shot! 😍', createdAt: now },
        { _id: new ObjectId(), user: carol._id, text: 'Love the colors!', createdAt: now },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      _id: new ObjectId(), author: bob._id,
      imageUrl: 'https://picsum.photos/seed/bob1/600/600', images: [], caption: 'Exploring new places 🗺️',
      likes: [alice._id, eve._id],
      comments: [
        { _id: new ObjectId(), user: alice._id, text: 'Where is this??', createdAt: now },
        { _id: new ObjectId(), user: dave._id, text: 'So cool!', createdAt: now },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      _id: new ObjectId(), author: carol._id,
      imageUrl: 'https://picsum.photos/seed/carol1/600/600', images: [], caption: 'Good vibes only ✌️',
      likes: [alice._id, bob._id, dave._id, eve._id],
      comments: [{ _id: new ObjectId(), user: eve._id, text: 'Yasss queen! 👑', createdAt: now }],
      createdAt: now, updatedAt: now,
    },
    {
      _id: new ObjectId(), author: dave._id,
      imageUrl: 'https://picsum.photos/seed/dave1/600/600', images: [], caption: 'Morning coffee hit different ☕',
      likes: [carol._id, alice._id], comments: [], createdAt: now, updatedAt: now,
    },
    {
      _id: new ObjectId(), author: eve._id,
      imageUrl: 'https://picsum.photos/seed/eve1/600/600', images: [], caption: 'New artwork drop 🎨',
      likes: [alice._id, bob._id, carol._id, dave._id],
      comments: [
        { _id: new ObjectId(), user: alice._id, text: 'This is incredible!!', createdAt: now },
        { _id: new ObjectId(), user: bob._id, text: 'Genius 🔥', createdAt: now },
        { _id: new ObjectId(), user: carol._id, text: 'Want this on my wall!', createdAt: now },
      ],
      createdAt: now, updatedAt: now,
    },
  ]);
  console.log('Created 5 posts');

  console.log('\n--- Seed complete ---');
  console.log('Users (password for all: password123):');
  userDocs.forEach((u) => console.log(`  ${u.username} — ${u.email}`));

  await disconnectDB();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
