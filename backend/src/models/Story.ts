import { ObjectId } from 'mongodb';

export interface IStory {
  _id: ObjectId;
  author: ObjectId;
  image: string;
  caption: string;
  views: ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}
