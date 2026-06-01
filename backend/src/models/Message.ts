import { ObjectId } from 'mongodb';

export interface IMessage {
  _id: ObjectId;
  conversation: ObjectId;
  sender: ObjectId;
  content: string;
  readBy: ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}
