import { MongoClient, Db } from 'mongodb';

// Moduł-singleton: jeden klient i jedno połączenie przez cały czas życia procesu
let client: MongoClient;
let db: Db;

/**
 * Zwraca instancję bazy danych.
 * Rzuca wyjątek jeśli connectDB() nie zostało wcześniej wywołane.
 */
export function getDb(): Db {
  if (!db) throw new Error('Database not initialized. Call connectDB() first.');
  return db;
}

/**
 * Nawiązuje połączenie z MongoDB, tworzy wymagane indeksy
 * i rejestruje nasłuchiwanie na zdarzenia błędów.
 */
export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not defined in environment variables');

  client = new MongoClient(uri);
  await client.connect();
  db = client.db('instagram');

  // Indeks unikalny na email i username — zapobiega duplikatom kont
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('users').createIndex({ username: 1 }, { unique: true });

  // TTL index na stories.createdAt — MongoDB automatycznie usuwa dokument po 24h (86400 s)
  await db.collection('stories').createIndex({ createdAt: 1 }, { expireAfterSeconds: 86400 });

  // Indeks złożony na konwersacje — szybkie wyszukiwanie po uczestnikach
  await db.collection('conversations').createIndex({ participants: 1 });

  // Indeks złożony na wiadomości — szybkie pobieranie wiadomości z danej konwersacji posortowanych chronologicznie
  await db.collection('messages').createIndex({ conversation: 1, createdAt: 1 });

  client.on('close', () => console.warn('MongoDB disconnected'));
  client.on('error', (err) => console.error('MongoDB error:', err));

  console.log('Connected to MongoDB');
}

/** Zamyka połączenie z bazą (używane przy zatrzymywaniu serwera / w testach). */
export async function disconnectDB(): Promise<void> {
  await client?.close();
}
