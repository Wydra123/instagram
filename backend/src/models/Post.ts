import { ObjectId } from 'mongodb';

export interface IComment {
  _id: ObjectId;
  user: ObjectId;
  text: string;
  createdAt: Date;
}

export interface IPost {
  _id: ObjectId;
  author: ObjectId;
  imageUrl: string;
  images: string[];
  caption: string;
  likes: ObjectId[];
  comments: IComment[];
  createdAt: Date;
  updatedAt: Date;
}
