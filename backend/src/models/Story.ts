import { Schema, model, Document } from 'mongoose';

export interface IStory extends Document {
  author: Schema.Types.ObjectId;
  image: string;
  caption: string;
  views: Schema.Types.ObjectId[];
  createdAt: Date;
}

const storySchema = new Schema<IStory>(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    image: { type: String, required: true },
    caption: { type: String, default: '', maxlength: 2200 },
    views: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

// Auto-delete after 24 hours
storySchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

export const Story = model<IStory>('Story', storySchema);
