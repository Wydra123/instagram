import { ObjectId } from 'mongodb';

export interface IConversation {
  _id: ObjectId;
  participants: ObjectId[];
  lastMessage: ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}
