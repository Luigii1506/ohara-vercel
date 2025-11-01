import mongoose from 'mongoose';

const userCollectionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    cards: [
        {
            cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true },
            quantity: { type: Number, default: 1 },
        },
    ],
}, { timestamps: true });

const UserCollection = mongoose.models.UserCollection || mongoose.model('UserCollection', userCollectionSchema);

export default UserCollection;
