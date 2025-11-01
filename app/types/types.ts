import mongoose from 'mongoose';

export interface ICard {
    cardId: mongoose.Types.ObjectId;
    quantity: number;
}

export interface IUserCollection {
    userId: mongoose.Types.ObjectId;
    cards: ICard[];
}
