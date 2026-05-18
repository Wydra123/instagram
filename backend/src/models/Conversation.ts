import { Schema, model, Document } from 'mongoose';

export interface IConversation extends Document {
  participants: Schema.Types.ObjectId[];
  lastMessage: Schema.Types.ObjectId | null;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    lastMessage: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
  },
  { timestamps: true }
);

// Unikalny indeks — para uczestników (kolejność nieważna)
conversationSchema.index({ participants: 1 });

export const Conversation = model<IConversation>('Conversation', conversationSchema);
