import { ObjectId } from 'mongodb';

export interface IUser {
  _id: ObjectId;
  username: string;
  email: string;
  passwordHash: string;
  profilePicture: string;
  bio: string;
  followers: ObjectId[];
  following: ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}
