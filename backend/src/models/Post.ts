import { Schema, model, Document } from 'mongoose';

export interface IPost extends Document {
  author: Schema.Types.ObjectId;
  imageUrl: string;
  caption: string;
  likes: Schema.Types.ObjectId[];
  comments: {
    user: Schema.Types.ObjectId;
    text: string;
    createdAt: Date;
  }[];
  createdAt: Date;
}

const postSchema = new Schema<IPost>(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    imageUrl: { type: String, required: true },
    caption: { type: String, default: '', maxlength: 2200 },
    likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    comments: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        text: { type: String, required: true, maxlength: 300 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export const Post = model<IPost>('Post', postSchema);
