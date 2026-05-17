import { Schema, model, Document } from 'mongoose';

export interface IPost extends Document {
  author: Schema.Types.ObjectId;
  imageUrl?: string;
  images: string[];
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
    imageUrl: { type: String, default: '' },
    images: { type: [String], default: [] },
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

// Normalize legacy imageUrl → images array on serialization
postSchema.set('toJSON', {
  transform: (_doc, ret) => {
    if (!ret.images?.length && ret.imageUrl) {
      ret.images = [ret.imageUrl];
    }
    ret.images = ret.images ?? [];
    return ret;
  },
});

export const Post = model<IPost>('Post', postSchema);
