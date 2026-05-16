import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from './connection';
import { User } from '../models/User';
import { Post } from '../models/Post';

dotenv.config();

const SAMPLE_USERS = [
  {
    username: 'alice',
    email: 'alice@example.com',
    password: 'password123',
    bio: 'Photography lover 📸',
    profilePicture: 'https://i.pravatar.cc/150?u=alice',
  },
  {
    username: 'bob',
    email: 'bob@example.com',
    password: 'password123',
    bio: 'Travel & food enthusiast 🌍',
    profilePicture: 'https://i.pravatar.cc/150?u=bob',
  },
  {
    username: 'carol',
    email: 'carol@example.com',
    password: 'password123',
    bio: 'Just living life ✨',
    profilePicture: 'https://i.pravatar.cc/150?u=carol',
  },
  {
    username: 'dave',
    email: 'dave@example.com',
    password: 'password123',
    bio: 'Coffee addict ☕',
    profilePicture: 'https://i.pravatar.cc/150?u=dave',
  },
  {
    username: 'eve',
    email: 'eve@example.com',
    password: 'password123',
    bio: 'Art & design 🎨',
    profilePicture: 'https://i.pravatar.cc/150?u=eve',
  },
];

async function seed() {
  await connectDB();

  // Clear existing data
  await User.deleteMany({});
  await Post.deleteMany({});
  console.log('Cleared existing users and posts');

  // Create users
  const createdUsers = await Promise.all(
    SAMPLE_USERS.map(async (u) => {
      const passwordHash = await bcrypt.hash(u.password, 10);
      return User.create({
        username: u.username,
        email: u.email,
        passwordHash,
        bio: u.bio,
        profilePicture: u.profilePicture,
      });
    })
  );
  console.log(`Created ${createdUsers.length} users`);

  // Wire up some follow relationships
  const [alice, bob, carol, dave, eve] = createdUsers;

  await User.findByIdAndUpdate(alice._id, {
    following: [bob._id, carol._id],
    followers: [bob._id, eve._id],
  });
  await User.findByIdAndUpdate(bob._id, {
    following: [alice._id, dave._id],
    followers: [alice._id, carol._id],
  });
  await User.findByIdAndUpdate(carol._id, {
    following: [bob._id, eve._id],
    followers: [alice._id, dave._id],
  });
  await User.findByIdAndUpdate(dave._id, {
    following: [carol._id, alice._id],
    followers: [bob._id, eve._id],
  });
  await User.findByIdAndUpdate(eve._id, {
    following: [alice._id, dave._id],
    followers: [carol._id, dave._id],
  });
  console.log('Set up follow relationships');

  // Create sample posts
  const posts = await Post.insertMany([
    {
      author: alice._id,
      imageUrl: 'https://picsum.photos/seed/alice1/600/600',
      caption: 'Beautiful morning! 🌅',
      likes: [bob._id, carol._id, dave._id],
      comments: [
        { user: bob._id, text: 'Stunning shot! 😍' },
        { user: carol._id, text: 'Love the colors!' },
      ],
    },
    {
      author: bob._id,
      imageUrl: 'https://picsum.photos/seed/bob1/600/600',
      caption: 'Exploring new places 🗺️',
      likes: [alice._id, eve._id],
      comments: [
        { user: alice._id, text: 'Where is this??' },
        { user: dave._id, text: 'So cool!' },
      ],
    },
    {
      author: carol._id,
      imageUrl: 'https://picsum.photos/seed/carol1/600/600',
      caption: 'Good vibes only ✌️',
      likes: [alice._id, bob._id, dave._id, eve._id],
      comments: [{ user: eve._id, text: 'Yasss queen! 👑' }],
    },
    {
      author: dave._id,
      imageUrl: 'https://picsum.photos/seed/dave1/600/600',
      caption: 'Morning coffee hit different ☕',
      likes: [carol._id, alice._id],
      comments: [],
    },
    {
      author: eve._id,
      imageUrl: 'https://picsum.photos/seed/eve1/600/600',
      caption: 'New artwork drop 🎨',
      likes: [alice._id, bob._id, carol._id, dave._id],
      comments: [
        { user: alice._id, text: 'This is incredible!!' },
        { user: bob._id, text: 'Genius 🔥' },
        { user: carol._id, text: 'Want this on my wall!' },
      ],
    },
  ]);
  console.log(`Created ${posts.length} posts`);

  console.log('\n--- Seed complete ---');
  console.log('Users (password for all: password123):');
  createdUsers.forEach((u) => console.log(`  ${u.username} — ${u.email}`));

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
