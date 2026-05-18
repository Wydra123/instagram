import { Schema, model, Document } from 'mongoose';

export interface IMessage extends Document {
  conversation: Schema.Types.ObjectId;
  sender: Schema.Types.ObjectId;
  content: string;
  readBy: Schema.Types.ObjectId[];
  createdAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true, maxlength: 2000 },
    readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: 1 });

export const Message = model<IMessage>('Message', messageSchema);
